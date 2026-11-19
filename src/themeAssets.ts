import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Файлы темы (шрифты и фоновые картинки), загружаемые администратором.
 * Тип определяется по сигнатуре содержимого, а не по имени/MIME. SVG намеренно не поддерживается
 * (он может содержать скрипты), расширение файла на диске выбирает сервер.
 */

export type AssetKind = 'font' | 'image';

export interface DetectedAsset { ext: string; kind: AssetKind }

export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export function detectAsset(buf: Buffer): DetectedAsset | null {
  if (buf.length < 12) return null;
  const ascii = (from: number, to: number) => buf.toString('latin1', from, to);
  // шрифты
  if (ascii(0, 4) === 'wOF2') return { ext: 'woff2', kind: 'font' };
  if (ascii(0, 4) === 'wOFF') return { ext: 'woff', kind: 'font' };
  if (ascii(0, 4) === 'OTTO') return { ext: 'otf', kind: 'font' };
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return { ext: 'ttf', kind: 'font' };
  if (ascii(0, 4) === 'true') return { ext: 'ttf', kind: 'font' };
  // изображения
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', kind: 'image' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', kind: 'image' };
  if (ascii(0, 4) === 'GIF8') return { ext: 'gif', kind: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', kind: 'image' };
  if (ascii(4, 8) === 'ftyp' && /^(avif|avis)/.test(ascii(8, 12))) return { ext: 'avif', kind: 'image' };
  return null;
}

export const ASSET_NAME_RE = /^[a-f0-9]{16}\.(woff2|woff|ttf|otf|png|jpg|gif|webp|avif)$/;

export function saveAsset(dir: string, buf: Buffer): { name: string; url: string; kind: AssetKind; size: number } {
  const detected = detectAsset(buf);
  if (!detected) throw Object.assign(new Error('Неподдерживаемый файл. Допустимы шрифты woff2/woff/ttf/otf и картинки png/jpg/webp/gif/avif.'), { status: 415 });
  if (buf.length > MAX_ASSET_BYTES) throw Object.assign(new Error('Файл больше 8 МБ'), { status: 413 });
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomBytes(8).toString('hex')}.${detected.ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, url: `/theme-assets/${name}`, kind: detected.kind, size: buf.length };
}

export function listAssets(dir: string): { name: string; url: string; kind: AssetKind; size: number; mtime: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => ASSET_NAME_RE.test(n))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      const ext = name.split('.').pop()!;
      return { name, url: `/theme-assets/${name}`, kind: (['woff2', 'woff', 'ttf', 'otf'].includes(ext) ? 'font' : 'image') as AssetKind, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export function deleteAsset(dir: string, name: string): boolean {
  if (!ASSET_NAME_RE.test(name)) return false;
  const full = path.join(dir, name);
  if (!fs.existsSync(full)) return false;
  fs.rmSync(full, { force: true });
  return true;
}
