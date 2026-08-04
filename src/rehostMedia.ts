import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processUploadedImage, type ImageUploadType } from './imageProcessing';
import { processUploadedVideo } from './videoProcessing';

export type RehostMediaType = 'avatar' | 'bg' | 'video' | 'audio' | 'cursor';

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;

const ALLOWED_HOSTS = new Set([
  'images.guns.lol',
  'r2.guns.lol',
  'cdn.guns.lol',
  'guns.lol',
  'www.guns.lol',
]);

function isLocalUploadUrl(url: string): boolean {
  return url.startsWith('/uploads/');
}

function isAllowedRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    if (host.endsWith('.guns.lol')) return true;
    // Block private/reserved IPs
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|localhost|::1|\[::1\])/.test(host)) {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

async function downloadToTemp(url: string, tmpDir: string): Promise<{ tmpPath: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CRY-BIOS-Rehost/1.0' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BYTES) {
      throw new Error('File too large');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      throw new Error('File too large');
    }

    const extFromUrl = path.extname(new URL(url).pathname) || guessExt(contentType);
    const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}${extFromUrl}`);
    fs.writeFileSync(tmpPath, buffer);
    return { tmpPath, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function guessExt(contentType: string): string {
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('mp4')) return '.mp4';
  if (contentType.includes('webm')) return '.webm';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return '.mp3';
  return '.bin';
}

function copyRawToUploads(tmpPath: string, uploadsDir: string): string {
  const ext = path.extname(tmpPath) || '.bin';
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.copyFileSync(tmpPath, path.join(uploadsDir, filename));
  fs.unlinkSync(tmpPath);
  return `/uploads/${filename}`;
}

export async function rehostRemoteUrl(
  url: string | undefined | null,
  uploadsDir: string,
  tmpDir: string,
  type: RehostMediaType
): Promise<string | null> {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim().replace(/^['"]|['"]$/g, '');

  if (isLocalUploadUrl(trimmed)) return trimmed;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;
  if (!isAllowedRemoteUrl(trimmed)) {
    console.warn(`[rehost] Blocked URL (not allowlisted): ${trimmed}`);
    return trimmed;
  }

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  let tmpPath: string | null = null;
  try {
    const { tmpPath: downloaded, contentType } = await downloadToTemp(trimmed, tmpDir);
    tmpPath = downloaded;

    const isGif = trimmed.toLowerCase().includes('.gif') || contentType.includes('gif');
    const isVideo = type === 'video' || contentType.startsWith('video/') || /\.(mp4|webm|ogv)$/i.test(trimmed);
    const isAudio = type === 'audio' || contentType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(trimmed);

    if (isVideo) {
      const result = await processUploadedVideo(tmpPath, uploadsDir);
      tmpPath = null;
      return `/uploads/${result.filename}`;
    }

    if (isAudio || type === 'cursor') {
      return copyRawToUploads(tmpPath, uploadsDir);
    }

    if (isGif) {
      return copyRawToUploads(tmpPath, uploadsDir);
    }

    const imageType: ImageUploadType = type === 'avatar' ? 'avatar' : type === 'bg' ? 'bg' : 'image';
    const result = await processUploadedImage(tmpPath, uploadsDir, imageType);
    tmpPath = null;
    return `/uploads/${result.filename}`;
  } catch (err: any) {
    console.warn(`[rehost] Failed to rehost ${trimmed}: ${err.message}`);
    return trimmed;
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}

export async function rehostImportMedia(
  data: {
    avatarUrl?: string;
    bgType?: string;
    bgValue?: string;
    audioUrl?: string;
    customCursorUrl?: string;
    playlist?: { id: string; url: string; title: string; artist: string }[];
  },
  uploadsDir: string,
  tmpDir: string,
  onProgress?: (current: number, total: number, label: string) => void
): Promise<typeof data> {
  const result = { ...data };
  const tasks: { key: string; url: string; type: RehostMediaType }[] = [];

  if (data.avatarUrl) tasks.push({ key: 'avatarUrl', url: data.avatarUrl, type: 'avatar' });
  if (data.bgValue && data.bgType === 'video') tasks.push({ key: 'bgValue', url: data.bgValue, type: 'video' });
  else if (data.bgValue && (data.bgType === 'image' || /\.(gif|png|jpg|jpeg|webp)/i.test(data.bgValue))) {
    tasks.push({ key: 'bgValue', url: data.bgValue, type: 'bg' });
  }
  if (data.audioUrl) tasks.push({ key: 'audioUrl', url: data.audioUrl, type: 'audio' });
  if (data.customCursorUrl) tasks.push({ key: 'customCursorUrl', url: data.customCursorUrl, type: 'cursor' });

  if (data.playlist?.length) {
    data.playlist.forEach((track, i) => {
      if (track.url) tasks.push({ key: `playlist-${i}`, url: track.url, type: 'audio' });
    });
  }

  let done = 0;
  const total = tasks.length;

  for (const task of tasks) {
    onProgress?.(done + 1, total, task.key);
    const rehosted = await rehostRemoteUrl(task.url, uploadsDir, tmpDir, task.type);
    if (task.key.startsWith('playlist-')) {
      const idx = parseInt(task.key.split('-')[1], 10);
      if (result.playlist?.[idx] && rehosted) result.playlist[idx].url = rehosted;
    } else {
      (result as any)[task.key] = rehosted || task.url;
    }
    done++;
  }

  return result;
}
