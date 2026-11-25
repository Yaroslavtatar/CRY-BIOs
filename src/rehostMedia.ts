import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processUploadedImage, type ImageUploadType } from './imageProcessing';
import { processUploadedVideo } from './videoProcessing';
import { processUploadedAudio } from './audioProcessing';
import { processMedia } from './mediaPipeline';
import { isImportMediaHost } from './import/mediaHosts';

export type RehostMediaType = 'avatar' | 'bg' | 'video' | 'audio' | 'cursor';

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;

const ALLOWED_HOSTS = new Set([
  'images.guns.lol',
  'r2.guns.lol',
  'cdn.guns.lol',
  'guns.lol',
  'www.guns.lol',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.imgur.com',
  'cdn.cbios.ru',
]);

function isLocalUploadUrl(url: string): boolean {
  return url.startsWith('/uploads/');
}

function isAllowedRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS.has(host) || host.endsWith('.guns.lol') || isImportMediaHost(host);
  } catch {
    return false;
  }
}

async function downloadToTemp(url: string, tmpDir: string): Promise<{ tmpPath: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Редиректы вручную: каждый шаг проверяется по allowlist (защита от SSRF)
    let currentUrl = url;
    let response: Response | null = null;
    for (let hop = 0; hop <= 3; hop++) {
      if (!isAllowedRemoteUrl(currentUrl)) throw new Error('Redirect target not allowed');
      response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CRY-BIOS-Rehost/1.0' },
        redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Bad redirect');
        currentUrl = new URL(location, currentUrl).toString();
        response = null;
        continue;
      }
      break;
    }
    if (!response) throw new Error('Too many redirects');

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
    // Расширение временного файла — только из белого списка

    const urlExt = path.extname(new URL(url).pathname).toLowerCase();
    const extFromUrl = SAFE_TMP_EXTS.has(urlExt) ? urlExt : guessExt(contentType);
    const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}${extFromUrl}`);
    fs.writeFileSync(tmpPath, buffer);
    return { tmpPath, contentType };
  } finally {
    clearTimeout(timer);
  }
}

const SAFE_TMP_EXTS = new Set(['.gif', '.png', '.webp', '.jpg', '.jpeg', '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.m4a']);

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

function mapImageType(type: RehostMediaType): ImageUploadType {
  if (type === 'avatar') return 'avatar';
  if (type === 'cursor') return 'image';
  return 'bg';
}

export async function rehostRemoteUrl(
  url: string | undefined | null,
  uploadsDir: string,
  tmpDir: string,
  type: RehostMediaType,
  dataDir?: string,
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

    const mediaDataDir = dataDir || path.join(path.dirname(uploadsDir));

    if (type === 'video' || contentType.includes('video')) {
      const result = await processMedia({
        dataDir: mediaDataDir,
        uploadsDir,
        inputPath: tmpPath,
        kind: 'video',
      });
      tmpPath = null;
      return result.url;
    }

    if (type === 'audio' || contentType.includes('audio')) {
      const result = await processMedia({
        dataDir: mediaDataDir,
        uploadsDir,
        inputPath: tmpPath,
        kind: 'audio',
        audioBitrate: '96k',
      });
      tmpPath = null;
      return result.url;
    }

    const imageType = mapImageType(type);
    const result = await processMedia({
      dataDir: mediaDataDir,
      uploadsDir,
      inputPath: tmpPath,
      kind: 'image',
      imageType,
    });
    tmpPath = null;
    return result.url;
  } catch (err: any) {
    console.warn(`[rehost] Failed to rehost ${trimmed}: ${err.message}`);
    // Сырой файл в uploads не сохраняем; остаётся исходная (allowlisted) ссылка
    return trimmed;
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
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
  onProgress?: (current: number, total: number, label: string) => void,
  dataDir?: string,
): Promise<typeof data> {
  const result = { ...data, playlist: data.playlist ? [...data.playlist] : undefined };
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

  const total = tasks.length;
  let done = 0;
  const concurrency = parseInt(process.env.MEDIA_MAX_CONCURRENT || '2', 10) || 2;

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    onProgress?.(done + 1, total, task.key);
    const rehosted = await rehostRemoteUrl(task.url, uploadsDir, tmpDir, task.type, dataDir);
    if (task.key.startsWith('playlist-')) {
      const idx = parseInt(task.key.split('-')[1], 10);
      if (result.playlist?.[idx] && rehosted) result.playlist[idx].url = rehosted;
    } else {
      (result as any)[task.key] = rehosted || task.url;
    }
    done++;
    onProgress?.(done, total, task.key);
    return rehosted;
  });

  return result;
}
