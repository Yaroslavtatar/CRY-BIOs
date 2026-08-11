import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { importFullBackup, getMaxBackupBytes } from './backup';

export { getMaxBackupBytes };

export type ImportJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface ImportJobState {
  jobId: string;
  status: ImportJobStatus;
  progress: string;
  error?: string;
  userCount?: number;
  uploadCount?: number;
  createdAt: number;
}

export interface PendingUpload {
  uploadId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  dir: string;
  createdAt: number;
}

const pendingUploads = new Map<string, PendingUpload>();
const importJobs = new Map<string, ImportJobState>();

export function getChunkBytes(): number {
  const mb = Number(process.env.BACKUP_CHUNK_MB || 8);
  if (!Number.isFinite(mb) || mb <= 0) return 8 * 1024 * 1024;
  return mb * 1024 * 1024;
}

function uploadsRoot(dataDir: string): string {
  return path.join(dataDir, 'tmp', 'import_uploads');
}

function incomingDir(dataDir: string): string {
  const dir = path.join(dataDir, 'incoming');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeBasename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function rmDir(dir: string) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function cleanupStaleUploads(dataDir: string, maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  for (const [id, upload] of pendingUploads.entries()) {
    if (now - upload.createdAt > maxAgeMs) {
      rmDir(upload.dir);
      pendingUploads.delete(id);
    }
  }
  for (const [id, job] of importJobs.entries()) {
    if (now - job.createdAt > maxAgeMs * 2) {
      importJobs.delete(id);
    }
  }
}

export function initChunkedUpload(
  dataDir: string,
  input: { filename: string; totalSize: number; totalChunks: number },
): { uploadId: string } {
  cleanupStaleUploads(dataDir);

  const maxBytes = getMaxBackupBytes();
  if (input.totalSize <= 0 || input.totalSize > maxBytes) {
    throw new Error(`Invalid backup size (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
  }
  if (input.totalChunks < 1 || input.totalChunks > 100000) {
    throw new Error('Invalid chunk count');
  }

  const uploadId = crypto.randomUUID();
  const dir = path.join(uploadsRoot(dataDir), uploadId);
  fs.mkdirSync(dir, { recursive: true });

  pendingUploads.set(uploadId, {
    uploadId,
    filename: safeBasename(input.filename),
    totalSize: input.totalSize,
    totalChunks: input.totalChunks,
    receivedChunks: new Set(),
    dir,
    createdAt: Date.now(),
  });

  return { uploadId };
}

export function saveUploadChunk(
  uploadId: string,
  index: number,
  chunkPath: string,
): { received: number; total: number } {
  const upload = pendingUploads.get(uploadId);
  if (!upload) throw new Error('Upload session not found or expired');

  if (index < 0 || index >= upload.totalChunks) {
    throw new Error('Invalid chunk index');
  }

  const dest = path.join(upload.dir, `${index}.part`);
  fs.renameSync(chunkPath, dest);
  upload.receivedChunks.add(index);

  return { received: upload.receivedChunks.size, total: upload.totalChunks };
}

async function assembleZipFile(upload: PendingUpload): Promise<string> {
  if (upload.receivedChunks.size !== upload.totalChunks) {
    throw new Error(`Missing chunks: ${upload.receivedChunks.size}/${upload.totalChunks}`);
  }

  const outPath = path.join(upload.dir, upload.filename);
  const out = fs.createWriteStream(outPath);

  for (let i = 0; i < upload.totalChunks; i++) {
    const partPath = path.join(upload.dir, `${i}.part`);
    if (!fs.existsSync(partPath)) {
      throw new Error(`Missing chunk file ${i}`);
    }
    await new Promise<void>((resolve, reject) => {
      const read = fs.createReadStream(partPath);
      read.on('error', reject);
      read.on('end', resolve);
      read.pipe(out, { end: false });
    });
    fs.unlinkSync(partPath);
  }

  await new Promise<void>((resolve, reject) => {
    out.on('error', reject);
    out.on('finish', resolve);
    out.end();
  });

  const stat = fs.statSync(outPath);
  if (stat.size !== upload.totalSize) {
    throw new Error(`Assembled size mismatch: expected ${upload.totalSize}, got ${stat.size}`);
  }

  return outPath;
}

function runImportJob(
  jobId: string,
  zipPath: string,
  options: { uploadsDir: string; dataDir: string },
  cleanupDirs: string[] = [],
) {
  const job = importJobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.progress = 'Распаковка архива...';

  setImmediate(async () => {
    try {
      const result = await importFullBackup(zipPath, options);
      job.status = 'done';
      job.progress = 'Готово';
      job.userCount = result.userCount;
      job.uploadCount = result.uploadCount;
    } catch (err: any) {
      job.status = 'error';
      job.error = err.message || 'Import failed';
      job.progress = 'Ошибка';
    } finally {
      for (const dir of cleanupDirs) {
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {
        /* ignore */
      }
    }
  });
}

export function startImportFromAssembledUpload(
  uploadId: string,
  options: { uploadsDir: string; dataDir: string },
): { jobId: string } {
  const upload = pendingUploads.get(uploadId);
  if (!upload) throw new Error('Upload session not found or expired');

  return startImportFromUploadSession(upload, options);
}

function startImportFromUploadSession(
  upload: PendingUpload,
  options: { uploadsDir: string; dataDir: string },
): { jobId: string } {
  const zipPathPromise = assembleZipFile(upload);
  pendingUploads.delete(upload.uploadId);

  const jobId = crypto.randomUUID();
  importJobs.set(jobId, {
    jobId,
    status: 'queued',
    progress: 'Сборка ZIP...',
    createdAt: Date.now(),
  });

  zipPathPromise
    .then((zipPath) => {
      runImportJob(jobId, zipPath, options, [upload.dir]);
    })
    .catch((err) => {
      const job = importJobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = err.message || 'Assembly failed';
      }
      rmDir(upload.dir);
    });

  return { jobId };
}

export function getImportJob(jobId: string): ImportJobState | null {
  return importJobs.get(jobId) || null;
}

export function listIncomingBackupFiles(dataDir: string): { filename: string; size: number; mtime: string }[] {
  const dir = incomingDir(dataDir);
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((filename) => {
      const full = path.join(dir, filename);
      const stat = fs.statSync(full);
      return {
        filename,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export function startImportFromDisk(
  dataDir: string,
  filename: string,
  options: { uploadsDir: string; dataDir: string },
): { jobId: string } {
  const base = safeBasename(filename);
  if (!base.toLowerCase().endsWith('.zip')) {
    throw new Error('Only .zip files allowed');
  }

  const full = path.join(incomingDir(dataDir), base);
  const resolved = path.resolve(full);
  const incomingResolved = path.resolve(incomingDir(dataDir));
  if (!resolved.startsWith(incomingResolved + path.sep) && resolved !== incomingResolved) {
    throw new Error('Invalid filename');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('File not found in data/incoming/');
  }

  const stat = fs.statSync(resolved);
  if (stat.size > getMaxBackupBytes()) {
    throw new Error(`File exceeds max backup size (${process.env.BACKUP_MAX_MB || 2048} MB)`);
  }

  const jobId = crypto.randomUUID();
  importJobs.set(jobId, {
    jobId,
    status: 'queued',
    progress: 'Очередь...',
    createdAt: Date.now(),
  });

  runImportJob(jobId, resolved, options, []);
  return { jobId };
}

export function ensureIncomingDir(dataDir: string) {
  incomingDir(dataDir);
}
