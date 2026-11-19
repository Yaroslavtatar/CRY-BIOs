import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { sanitizeTheme, getDefaultTheme, buildThemeCss, cssValue, DEFAULT_COLORS, sanitizeAssetUrl } from '../src/theme';
import { sanitizeHomeLayout } from '../src/homeLayout';
import { detectAsset, saveAsset, listAssets, deleteAsset } from '../src/themeAssets';

describe('значения по умолчанию', () => {
  it('токены в index.css совпадают с DEFAULT_COLORS', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/index.css'), 'utf-8');
    const map: Record<string, string> = {
      accent: '--cb-accent', accentHover: '--cb-accent-hover', onAccent: '--cb-on-accent', bg: '--cb-bg', surface: '--cb-surface',
      deep: '--cb-deep', text: '--cb-text', muted: '--cb-muted', success: '--cb-success', warning: '--cb-warning', danger: '--cb-danger',
    };
    for (const [key, varName] of Object.entries(map)) {
      expect(css).toContain(`${varName}: ${(DEFAULT_COLORS as any)[key]};`);
    }
  });
  it('выключенная тема не генерирует CSS', () => {
    expect(buildThemeCss(getDefaultTheme())).toBe('');
  });
});

describe('sanitizeTheme', () => {
  it('отбрасывает значения, ломающие объявление CSS', () => {
    expect(cssValue('red; background:url(//evil)')).toBe('');
    expect(cssValue('red}</style><script>')).toBe('');
    expect(cssValue('url(http://insecure.test/a.png)')).toBe('');
    expect(cssValue('url(https://ok.test/a.png)')).toContain('https://ok.test');
    expect(cssValue('color-mix(in srgb, var(--cb-accent) 40%, red)')).not.toBe('');
    const t = sanitizeTheme({ enabled: true, colors: { accent: 'red;x:y', bg: '#123456' } });
    expect(t.colors.accent).toBe(DEFAULT_COLORS.accent);
    expect(t.colors.bg).toBe('#123456');
  });
  it('допускает только корректные имена CSS-переменных и убирает дубли', () => {
    const t = sanitizeTheme({ extraVars: [{ name: '--color-sky-400', value: '#38bdf8' }, { name: 'color: red', value: '1' }, { name: '--color-sky-400', value: '#000' }, { name: '--x}', value: '1' }] });
    expect(t.extraVars).toEqual([{ name: '--color-sky-400', value: '#38bdf8' }]);
  });
  it('шрифты: имя семейства очищается, файлы только из /theme-assets', () => {
    expect(sanitizeAssetUrl('/theme-assets/a1b2.woff2')).toBe('/theme-assets/a1b2.woff2');
    expect(sanitizeAssetUrl('https://evil.test/a.woff2')).toBe('');
    expect(sanitizeAssetUrl('/theme-assets/../../etc/passwd')).toBe('');
    const t = sanitizeTheme({ fonts: { body: 'Inter";}body{display:none', custom: [{ family: 'My Font', url: '/theme-assets/abc.woff2' }, { family: 'Bad', url: 'https://x.test/a.woff2' }, { family: 'Img', url: '/theme-assets/abc.png' }] } });
    expect(t.fonts.body).toBe('Interbodydisplaynone');
    expect(t.fonts.custom.map((f) => f.family)).toEqual(['My Font']);
  });
  it('ограничивает числа и перечисления', () => {
    const t = sanitizeTheme({ shape: { radius: 999 }, effects: { speed: 99, glow: -5, overlay: 'evil', entrance: 'zoom' }, fonts: { baseSize: 4 }, background: { angle: 1000, dim: 500, type: 'x' } });
    expect(t.shape.radius).toBe(40);
    expect(t.effects.speed).toBe(3);
    expect(t.effects.glow).toBe(0);
    expect(t.effects.overlay).toBe('none');
    expect(t.fonts.baseSize).toBe(12);
    expect(t.background.angle).toBe(360);
    expect(t.background.dim).toBe(90);
    expect(t.background.type).toBe('color');
  });
  it('мусор вместо темы даёт тему по умолчанию', () => {
    expect(sanitizeTheme(null)).toEqual(getDefaultTheme());
    expect(sanitizeTheme('x')).toEqual(getDefaultTheme());
  });
  it('свой CSS сохраняется как есть (до лимита)', () => {
    const css = '.x{color:red}\n@import url(https://example.com/a.css);';
    expect(sanitizeTheme({ customCss: css }).customCss).toBe(css);
    expect(sanitizeTheme({ customCss: 'a'.repeat(70000) }).customCss.length).toBe(60000);
  });
});

describe('buildThemeCss', () => {
  const on = (patch: any) => sanitizeTheme({ enabled: true, ...patch });
  it('переопределяет токены и палитру Tailwind', () => {
    const css = buildThemeCss(on({ colors: { accent: '#ff00aa', bg: '#101010' } }));
    expect(css).toContain(':root:root{--cb-accent:#ff00aa');
    expect(css).toContain('--cb-bg:#101010');
    expect(css).toContain('--color-white:var(--cb-text)');
    expect(css).toContain('--color-neutral-400:var(--cb-muted)');
    expect(css).toContain('--color-red-400:var(--cb-danger)');
  });
  it('шрифты: @font-face, Google @import первым, переменные', () => {
    const css = buildThemeCss(on({ fonts: { heading: 'Foo', body: 'Bar', google: [{ name: 'Open Sans', weights: '700;400' }], custom: [{ family: 'Foo', url: '/theme-assets/a.woff2', weight: 700 }] } }));
    expect(css.startsWith('@import url("https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700')).toBe(true);
    expect(css).toContain('@font-face{font-family:"Foo";src:url("/theme-assets/a.woff2") format("woff2");font-weight:700');
    expect(css).toContain('--font-display:"Foo"');
    expect(css).toContain('--font-sans:"Bar"');
  });
  it('фон: градиент, картинка, css', () => {
    expect(buildThemeCss(on({ background: { type: 'gradient', from: '#111', to: '#222', angle: 90 } }))).toContain('linear-gradient(90deg, #111, #222)');
    expect(buildThemeCss(on({ background: { type: 'image', imageUrl: '/theme-assets/bg.png' } }))).toContain('url("/theme-assets/bg.png")');
    expect(buildThemeCss(on({ background: { type: 'css', css: 'radial-gradient(circle, #000, #333)' } }))).toContain('background:radial-gradient(circle, #000, #333)');
    expect(buildThemeCss(on({ background: { type: 'image', imageUrl: 'http://x.test/a.png' } }))).not.toContain('x.test');
  });
  it('анимации обёрнуты в prefers-reduced-motion', () => {
    const css = buildThemeCss(on({ effects: { entrance: 'fade-up', hover: 'lift' } }));
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('@keyframes cb-enter');
  });
  it('режим scope изолирует правила, а свой CSS вкладывается в область', () => {
    const css = buildThemeCss(on({ customCss: '.a{color:red}', effects: { overlay: 'grid' } }), { scope: '.cb-preview-scope' });
    expect(css).toContain('.cb-preview-scope{--cb-accent');
    expect(css).toContain('.cb-preview-scope{\n.a{color:red}\n}');
    expect(css).not.toContain(':root:root');
    expect(css).toContain('.cb-preview-scope::before{content:"";position:absolute');
  });
  it('свой CSS без scope добавляется в конец без изменений', () => {
    const css = buildThemeCss(on({ customCss: 'h1{color:hotpink}' }));
    expect(css.trim().endsWith('h1{color:hotpink}')).toBe(true);
  });
});

describe('макет содержит тему', () => {
  it('sanitizeHomeLayout чистит вложенную тему', () => {
    const l = sanitizeHomeLayout({ blocks: [], theme: { enabled: true, colors: { accent: 'blue;evil' } } });
    expect(l.theme.enabled).toBe(true);
    expect(l.theme.colors.accent).toBe(DEFAULT_COLORS.accent);
  });
});

describe('themeAssets', () => {
  const woff2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(32)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
  it('определяет тип по сигнатуре, а не по имени', () => {
    expect(detectAsset(woff2)).toEqual({ ext: 'woff2', kind: 'font' });
    expect(detectAsset(png)).toEqual({ ext: 'png', kind: 'image' });
    expect(detectAsset(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectAsset(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectAsset(Buffer.alloc(4))).toBeNull();
  });
  it('сохраняет, перечисляет и удаляет только свои файлы', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-assets-'));
    const a = saveAsset(dir, woff2);
    expect(a.url).toMatch(/^\/theme-assets\/[a-f0-9]{16}\.woff2$/);
    expect(listAssets(dir).map((f) => f.name)).toEqual([a.name]);
    fs.writeFileSync(path.join(dir, 'stray.txt'), 'x');
    expect(listAssets(dir).length).toBe(1);
    expect(deleteAsset(dir, '../../etc/passwd')).toBe(false);
    expect(deleteAsset(dir, 'stray.txt')).toBe(false);
    expect(deleteAsset(dir, a.name)).toBe(true);
    expect(() => saveAsset(dir, Buffer.from('not a font or image at all'))).toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
