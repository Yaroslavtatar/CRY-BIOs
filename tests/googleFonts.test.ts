import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleFontCache, parseFontFaces, renderLocalFaces, googleCssUrl } from '../src/googleFonts';

const WOFF2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(64, 1)]);
const CSS = `
/* cyrillic */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/opensans/v40/a.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/opensans/v40/b.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Evil';
  src: url(https://evil.example/x.woff2) format('woff2');
}
`;

describe('googleFonts', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gf-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('парсит только woff2 с fonts.gstatic.com', () => {
    const faces = parseFontFaces(CSS);
    expect(faces).toHaveLength(2);
    expect(faces.map((f) => f.url.split('/').pop())).toEqual(['a.woff2', 'b.woff2']);
    expect(faces[0].unicodeRange).toContain('U+0400-045F');
  });

  it('формирует адрес CSS и локальный @font-face', () => {
    expect(googleCssUrl({ name: 'Open Sans', weights: '400;700' })).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
    const faces = parseFontFaces(CSS);
    const css = renderLocalFaces(faces, new Map([[faces[0].url, '/theme-assets/gf/1.woff2']]));
    expect(css).toContain('url("/theme-assets/gf/1.woff2")');
    expect(css).not.toContain('gstatic');
  });

  it('скачивает, кэширует на диск и повторно не ходит в сеть', async () => {
    let calls = 0;
    const fakeFetch = async (url: string) => {
      calls++;
      return url.includes('googleapis.com') ? new Response(CSS) : new Response(Buffer.concat([WOFF2, Buffer.from(url)]));
    };
    const cache = new GoogleFontCache(dir, '/theme-assets/gf', fakeFetch as typeof fetch);
    const font = { name: 'Open Sans', weights: '400' };
    const css = await cache.ensure(font);
    expect(css).toContain('/theme-assets/gf/');
    expect(css).toContain('unicode-range:U+0301');
    expect(fs.readdirSync(dir).filter((n) => n.endsWith('.woff2'))).toHaveLength(2);
    const before = calls;
    expect(await cache.ensure(font)).toBe(css);
    expect(calls).toBe(before);
    expect(cache.cached(font)).toBe(css);
  });

  it('при ошибке сети возвращает null и не повторяет запрос сразу', async () => {
    let calls = 0;
    const cache = new GoogleFontCache(dir, '/theme-assets/gf', (async () => { calls++; throw new Error('offline'); }) as unknown as typeof fetch);
    const font = { name: 'Roboto', weights: '400' };
    expect(await cache.ensure(font)).toBeNull();
    expect(await cache.ensure(font)).toBeNull();
    expect(calls).toBe(1);
  });

  it('отвергает файл, который не woff2', async () => {
    const fakeFetch = async (url: string) => (url.includes('googleapis.com') ? new Response(CSS) : new Response(Buffer.from('<html>not a font at all</html>')));
    const cache = new GoogleFontCache(dir, '/theme-assets/gf', fakeFetch as typeof fetch);
    expect(await cache.ensure({ name: 'Open Sans', weights: '400' })).toBeNull();
  });
});
