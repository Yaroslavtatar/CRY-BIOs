import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processUploadedImage, type ImageUploadType } from './imageProcessing';
import { processUploadedAudio } from './audioProcessing';
import { processUploadedVideo } from './videoProcessing';

export type MediaKind = 'image' | 'audio' | 'video';

export interface MediaIndexEntry {
  filename: string;
  bytes: number;
  type: MediaKind;
  avifFilename?: string;
  posterFilename?: string;
}

type MediaIndex = Record<string, MediaIndexEntry>;

let activeJobs = 0;
const waitQueue: Array<() => void> = [];

function maxConcurrent(): number {
  const n = parseInt(process.env.MEDIA_MAX_CONCURRENT || '2', 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

function dedupEnabled(): boolean {
  return process.env.MEDIA_ENABLE_DEDUP !== 'false';
}

function avifEnabled(): boolean {
  return process.env.MEDIA_ENABLE_AVIF === 'true';
}

async function acquireSlot(): Promise<void> {
  if (activeJobs < maxConcurrent()) {
    activeJobs++;
    return;
  }
  await new Promise<void>(resolve => waitQueue.push(resolve));
  activeJobs++;
}

function releaseSlot(): void {
  activeJobs--;
  const next = waitQueue.shift();
  if (next) next();
}

function indexPath(dataDir: string): string {
  return path.join(dataDir, 'media_index.json');
}

function loadIndex(dataDir: string): MediaIndex {
  const file = indexPath(dataDir);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as MediaIndex;
  } catch {
    return {};
  }
}

function saveIndex(dataDir: string, index: MediaIndex): void {
  fs.writeFileSync(indexPath(dataDir), JSON.stringify(index, null, 2), 'utf-8');
}

function fileHash(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function registerInIndex(
  dataDir: string,
  hash: string,
  entry: MediaIndexEntry,
): void {
  if (!dedupEnabled()) return;
  const index = loadIndex(dataDir);
  index[hash] = entry;
  saveIndex(dataDir, index);
}

function lookupDedup(dataDir: string, hash: string, uploadsDir: string): string | null {
  if (!dedupEnabled()) return null;
  const entry = loadIndex(dataDir)[hash];
  if (!entry) return null;
  const full = path.join(uploadsDir, entry.filename);
  if (!fs.existsSync(full)) return null;
  return `/uploads/${entry.filename}`;
}

async function maybeGenerateAvif(webpPath: string): Promise<string | undefined> {
  if (!avifEnabled()) return undefined;
  try {
    const sharp = (await import('sharp')).default;
    const avifPath = webpPath.replace(/\.webp$/i, '.avif');
    await sharp(webpPath).avif({ quality: 55 }).toFile(avifPath);
    return path.basename(avifPath);
  } catch {
    return undefined;
  }
}

export interface ProcessMediaOptions {
  dataDir: string;
  uploadsDir: string;
  inputPath: string;
  kind: MediaKind;
  imageType?: ImageUploadType;
  audioBitrate?: '96k' | '128k';
}

export interface ProcessMediaResult {
  url: string;
  thumbUrl?: string;
  deduplicated?: boolean;
  avifUrl?: string;
  posterUrl?: string;
}

export async function processMedia(options: ProcessMediaOptions): Promise<ProcessMediaResult> {
  await acquireSlot();
  try {
    const { dataDir, uploadsDir, inputPath, kind, imageType = 'bg', audioBitrate = '128k' } = options;
    const hash = fileHash(inputPath);
    const existing = lookupDedup(dataDir, hash, uploadsDir);
    if (existing) {
      fs.unlinkSync(inputPath);
      return { url: existing, deduplicated: true };
    }

    if (kind === 'image') {
      const result = await processUploadedImage(inputPath, uploadsDir, imageType);
      const webpFull = path.join(uploadsDir, result.filename);
      const avifFilename = await maybeGenerateAvif(webpFull);
      const bytes = fs.statSync(webpFull).size;
      registerInIndex(dataDir, hash, {
        filename: result.filename,
        bytes,
        type: 'image',
        avifFilename,
      });
      return {
        url: `/uploads/${result.filename}`,
        thumbUrl: result.thumbFilename ? `/uploads/thumbs/${result.thumbFilename}` : undefined,
        avifUrl: avifFilename ? `/uploads/${avifFilename}` : undefined,
      };
    }

    if (kind === 'audio') {
      const result = await processUploadedAudio(inputPath, uploadsDir, audioBitrate);
      const full = path.join(uploadsDir, result.filename);
      registerInIndex(dataDir, hash, {
        filename: result.filename,
        bytes: fs.statSync(full).size,
        type: 'audio',
      });
      return { url: `/uploads/${result.filename}` };
    }

    const result = await processUploadedVideo(inputPath, uploadsDir);
    const full = path.join(uploadsDir, result.filename);
    registerInIndex(dataDir, hash, {
      filename: result.filename,
      bytes: fs.statSync(full).size,
      type: 'video',
    });
    return { url: `/uploads/${result.filename}` };
  } finally {
    releaseSlot();
  }
}

export function resolveUploadFilePath(uploadsDir: string, reqPath: string): { filePath: string; contentType?: string } | null {
  const basename = path.basename(reqPath);
  if (!basename || basename.includes('..')) return null;

  const acceptAvif = reqPath.endsWith('.webp');
  if (acceptAvif && avifEnabled()) {
    const avifName = basename.replace(/\.webp$/i, '.avif');
    const avifPath = path.join(uploadsDir, avifName);
    if (fs.existsSync(avifPath)) {
      return { filePath: avifPath, contentType: 'image/avif' };
    }
  }

  const filePath = path.join(uploadsDir, basename);
  if (!fs.existsSync(filePath)) return null;
  return { filePath };
}

export async function optimizeAllMedia(
  dataDir: string,
  uploadsDir: string,
): Promise<{ processed: number; skipped: number; bytesBefore: number; bytesAfter: number }> {
  let processed = 0;
  let skipped = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  if (!fs.existsSync(uploadsDir)) {
    return { processed, skipped, bytesBefore, bytesAfter };
  }

  for (const entry of fs.readdirSync(uploadsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(uploadsDir, entry.name);
    const stat = fs.statSync(full);
    bytesBefore += stat.size;

    const ext = path.extname(entry.name).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);
    const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);

    if (!isImage && !isAudio && !isVideo) {
      skipped++;
      bytesAfter += stat.size;
      continue;
    }

    const tmpCopy = path.join(dataDir, 'tmp', `opt_${entry.name}`);
    fs.mkdirSync(path.dirname(tmpCopy), { recursive: true });
    fs.copyFileSync(full, tmpCopy);

    try {
      const kind: MediaKind = isImage ? 'image' : isAudio ? 'audio' : 'video';
      const result = await processMedia({
        dataDir,
        uploadsDir,
        inputPath: tmpCopy,
        kind,
        imageType: 'image',
      });
      if (result.deduplicated) {
        skipped++;
      } else {
        processed++;
        if (result.url !== `/uploads/${entry.name}`) {
          fs.unlinkSync(full);
        }
        const newName = path.basename(result.url);
        const newStat = fs.statSync(path.join(uploadsDir, newName));
        bytesAfter += newStat.size;
        continue;
      }
    } catch {
      skipped++;
    }
    bytesAfter += stat.size;
  }

  return { processed, skipped, bytesBefore, bytesAfter };
}
