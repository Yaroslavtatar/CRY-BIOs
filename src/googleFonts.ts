import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { detectAsset } from './themeAssets';

/**
 * Локальный кэш Google Fonts. Сервер один раз скачивает CSS и woff2-файлы у Google и отдаёт их со своего адреса:
 * посетители не обращаются к fonts.googleapis.com / fonts.gstatic.com, их IP третьей стороне не уходит.
 */

export interface GoogleFontRef { name: string; weights: string }

export interface ParsedFace {
  family: string;
  style: string;
  weight: string;
  unicodeRange: string;
  url: string;
}

const CSS_HOST = 'fonts.googleapis.com';
const FILE_HOST = 'fonts.gstatic.com';
const MAX_CSS_BYTES = 256 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 40;
const FETCH_TIMEOUT_MS = 8000;
const FAIL_RETRY_MS = 10 * 60 * 1000;
// Современный User-Agent нужен, чтобы Google отдал woff2 с разбивкой unicode-range по алфавитам
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function googleCssUrl(font: GoogleFontRef): string {
  return `https://${CSS_HOST}/css2?family=${font.name.replace(/ /g, '+')}:wght@${font.weights}&display=swap`;
}

/** Достаёт из CSS Google только блоки @font-face с woff2 с разрешённого хоста; остальное отбрасывает. */
export function parseFontFaces(css: string): ParsedFace[] {
  const faces: ParsedFace[] = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  for (const block of blocks) {
    const get = (prop: string) => block.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))?.[1]?.trim() ?? '';
    const family = get('font-family').replace(/^['"]|['"]$/g, '');
    const url = block.match(/url\(\s*['"]?(https:\/\/[^)'"\s]+)['"]?\s*\)\s*format\(\s*['"]woff2['"]\s*\)/)?.[1] ?? '';
    const unicodeRange = get('unicode-range');
    if (!/^[A-Za-z0-9 ]{1,40}$/.test(family) || !url) continue;
    if (unicodeRange && !/^[Uu+0-9A-Fa-f,\-\?\s]+$/.test(unicodeRange)) continue;
    let host = '';
    try { host = new URL(url).hostname; } catch { continue; }
    if (host !== FILE_HOST) continue;
    const style = get('font-style') === 'italic' ? 'italic' : 'normal';
    const weight = /^[0-9]{1,4}( [0-9]{1,4})?$/.test(get('font-weight')) ? get('font-weight') : '400';
    faces.push({ family, style, weight, unicodeRange, url });
  }
  return faces;
}

export function renderLocalFaces(faces: ParsedFace[], localUrls: Map<string, string>): string {
  return faces
    .filter((f) => localUrls.has(f.url))
    .map((f) =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
      `src:url("${localUrls.get(f.url)}") format("woff2");${f.unicodeRange ? `unicode-range:${f.unicodeRange};` : ''}}`)
    .join('\n');
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function readLimited(res: Response, limit: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > limit) throw new Error('response too large');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > limit) throw new Error('response too large');
  return buf;
}

export class GoogleFontCache {
  private failedAt = new Map<string, number>();
  private inflight = new Map<string, Promise<string | null>>();

  constructor(private dir: string, private publicPrefix = '/theme-assets/gf', private doFetch: FetchLike = fetch) {}

  private key(font: GoogleFontRef): string {
    return crypto.createHash('sha256').update(`${font.name}|${font.weights}`).digest('hex').slice(0, 16);
  }

  private cssPath(font: GoogleFontRef): string {
    return path.join(this.dir, `${this.key(font)}.css`);
  }

  /** Готовый локальный @font-face из кэша на диске (без обращения к сети) или null. */
  cached(font: GoogleFontRef): string | null {
    try { return fs.readFileSync(this.cssPath(font), 'utf8'); } catch { return null; }
  }

  /** Возвращает локальный CSS шрифта; при первом запросе скачивает его. Ошибка сети даёт null, а не исключение. */
  ensure(font: GoogleFontRef): Promise<string | null> {
    const hit = this.cached(font);
    if (hit) return Promise.resolve(hit);
    const k = this.key(font);
    const failed = this.failedAt.get(k);
    if (failed && Date.now() - failed < FAIL_RETRY_MS) return Promise.resolve(null);
    const running = this.inflight.get(k);
    if (running) return running;
    const p = this.download(font)
      .catch((err) => {
        console.warn(`[google-fonts] "${font.name}": ${err instanceof Error ? err.message : err}`);
        this.failedAt.set(k, Date.now());
        return null;
      })
      .finally(() => this.inflight.delete(k));
    this.inflight.set(k, p);
    return p;
  }

  private async fetchBuf(url: string, limit: number, accept: string): Promise<Buffer> {
    const res = await this.doFetch(url, {
      redirect: 'error',
      headers: { 'User-Agent': UA, Accept: accept },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return readLimited(res, limit);
  }

  private async download(font: GoogleFontRef): Promise<string> {
    const cssBuf = await this.fetchBuf(googleCssUrl(font), MAX_CSS_BYTES, 'text/css');
    const faces = parseFontFaces(cssBuf.toString('utf8')).slice(0, MAX_FILES);
    if (!faces.length) throw new Error('в ответе Google нет woff2-файлов (проверьте название и насыщенности)');
    fs.mkdirSync(this.dir, { recursive: true });
    const localUrls = new Map<string, string>();
    for (const face of faces) {
      if (localUrls.has(face.url)) continue;
      const buf = await this.fetchBuf(face.url, MAX_FILE_BYTES, 'font/woff2,*/*');
      if (detectAsset(buf)?.ext !== 'woff2') throw new Error('получен файл, не похожий на woff2');
      const name = `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)}.woff2`;
      fs.writeFileSync(path.join(this.dir, name), buf);
      localUrls.set(face.url, `${this.publicPrefix}/${name}`);
    }
    const css = renderLocalFaces(faces, localUrls);
    fs.writeFileSync(this.cssPath(font), css);
    return css;
  }
}
