import { ZipArchive } from 'archiver';
import type { Archiver } from 'archiver';
import extract from 'extract-zip';
import fs from 'fs';
import path from 'path';
import type { Response } from 'express';
import * as db from './db';

export const BACKUP_VERSION = 1;
const MAX_BACKUP_SIZE = 500 * 1024 * 1024;

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count += 1;
    }
  }
  return count;
}

function addDirectoryToArchive(archive: Archiver, dir: string, archivePath: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const entryArchivePath = path.join(archivePath, entry.name);
    if (entry.isDirectory()) {
      addDirectoryToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath.replace(/\\/g, '/') });
    }
  }
}

function clearDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

export function streamFullBackup(
  res: Response,
  options: { includeAnalytics: boolean; uploadsDir: string; dataDir: string }
) {
  const dump = db.exportDatabase({ includeAnalytics: options.includeAnalytics });
  const uploadCount = countFiles(options.uploadsDir);
  const meta = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userCount: dump.users.length,
    uploadCount,
    includeAnalytics: options.includeAnalytics,
  };

  const filename = `cry_bios_backup_${Date.now()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  archive.pipe(res);
  archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
  archive.append(JSON.stringify(dump, null, 2), { name: 'dump.json' });
  addDirectoryToArchive(archive, options.uploadsDir, 'uploads');

  if (fs.existsSync(path.join(options.dataDir, 'admin_password.txt'))) {
    archive.file(path.join(options.dataDir, 'admin_password.txt'), { name: 'admin_password.txt' });
  }

  return archive.finalize();
}

export async function importFullBackup(
  zipPath: string,
  options: { uploadsDir: string; dataDir: string }
): Promise<{ userCount: number; uploadCount: number }> {
  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_BACKUP_SIZE) {
    throw new Error('Backup file exceeds maximum allowed size (500 MB)');
  }

  const tmpDir = path.join(options.dataDir, 'tmp_restore');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await extract(zipPath, { dir: tmpDir });

    const metaPath = path.join(tmpDir, 'meta.json');
    const dumpPath = path.join(tmpDir, 'dump.json');
    if (!fs.existsSync(dumpPath)) {
      throw new Error('Invalid backup: dump.json not found');
    }

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.version && meta.version > BACKUP_VERSION) {
        throw new Error(`Unsupported backup version: ${meta.version}`);
      }
    }

    const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
    if (!dump || typeof dump !== 'object') {
      throw new Error('Invalid backup: malformed dump.json');
    }

    const extractedUploads = path.join(tmpDir, 'uploads');
    clearDirectory(options.uploadsDir);
    if (fs.existsSync(extractedUploads)) {
      for (const entry of fs.readdirSync(extractedUploads, { withFileTypes: true })) {
        const src = path.join(extractedUploads, entry.name);
        const dest = path.join(options.uploadsDir, entry.name);
        if (entry.isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    const adminPasswordSrc = path.join(tmpDir, 'admin_password.txt');
    if (fs.existsSync(adminPasswordSrc)) {
      fs.copyFileSync(adminPasswordSrc, path.join(options.dataDir, 'admin_password.txt'));
    }

    db.importDatabase(dump);

    return {
      userCount: dump.users?.length ?? 0,
      uploadCount: countFiles(options.uploadsDir),
    };
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

export function getThumbUrl(avatarUrl: string): string {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/') || avatarUrl.includes('/thumbs/')) {
    return avatarUrl;
  }
  const base = path.basename(avatarUrl, path.extname(avatarUrl));
  return `/uploads/thumbs/${base}.webp`;
}
