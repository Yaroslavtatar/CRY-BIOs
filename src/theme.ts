/**
 * Тема платформы: модель, валидация и генератор CSS.
 * Общий модуль: сервер отдаёт результат как /api/theme.css, конструктор строит из него изолированный предпросмотр.
 *
 * Принцип: сайт использует CSS-переменные --cb-* (см. src/index.css). Тема переопределяет их и палитру Tailwind,
 * а всё, чего не хватает, закрывает собственный CSS администратора (без ограничений по содержимому).
 */

export interface ThemeColors {
  accent: string;
  accentHover: string;
  onAccent: string;
  bg: string;
  surface: string;
  deep: string;
  text: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
}

/** Значения совпадают с :root в src/index.css (проверяется тестом). */
export const DEFAULT_COLORS: ThemeColors = {
  accent: '#00f2ff',
  accentHover: '#00d0e0',
  onAccent: '#000000',
  bg: '#050505',
  surface: '#0c0c0c',
  deep: '#000000',
  text: '#ffffff',
  muted: '#a3a3a3',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
};

export const COLOR_LABELS: Record<keyof ThemeColors, { label: string; hint: string }> = {
  accent: { label: 'Акцент', hint: 'Кнопки, ссылки, подсветка' },
  accentHover: { label: 'Акцент при наведении', hint: 'Цвет кнопок под курсором' },
  onAccent: { label: 'Текст на акценте', hint: 'Надписи на кнопках акцентного цвета' },
  bg: { label: 'Фон страницы', hint: 'Основной цвет фона' },
  surface: { label: 'Поверхности', hint: 'Секции, панели, карточки' },
  deep: { label: 'Глубокий тон', hint: 'Затемнения и «чёрные» блоки' },
  text: { label: 'Основной текст', hint: 'Заголовки и текст, рамки и полупрозрачные слои' },
  muted: { label: 'Второстепенный текст', hint: 'Описания и подписи' },
  success: { label: 'Успех', hint: 'Зелёные статусы' },
  warning: { label: 'Предупреждение', hint: 'Жёлтые статусы' },
  danger: { label: 'Ошибка', hint: 'Красные статусы и удаление' },
};

export type BackgroundType = 'color' | 'gradient' | 'image' | 'css';
export type OverlayKind = 'none' | 'grid' | 'noise' | 'scanlines' | 'aurora';
export type EntranceKind = 'none' | 'fade' | 'fade-up' | 'zoom' | 'slide';
export type HoverKind = 'none' | 'lift' | 'glow' | 'scale';

export interface CustomFont {
  id: string;
  family: string;
  /** только /theme-assets/<файл> */
  url: string;
  weight: number;
  style: 'normal' | 'italic';
}

export interface GoogleFont {
  name: string;
  /** «400;700» */
  weights: string;
}

export interface ThemeExtraVar { name: string; value: string }

export interface Theme {
  /** false — тема не применяется вовсе, сайт выглядит как по умолчанию */
  enabled: boolean;
  colors: ThemeColors;
  extraVars: ThemeExtraVar[];
  background: {
    type: BackgroundType;
    from: string;
    to: string;
    angle: number;
    imageUrl: string;
    size: 'cover' | 'contain' | 'auto';
    fixed: boolean;
    /** затемнение картинки цветом фона, 0–90 % */
    dim: number;
    css: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
    google: GoogleFont[];
    custom: CustomFont[];
    baseSize: number | null;
    plainHeadings: boolean;
  };
  shape: { radius: number | null };
  effects: {
    overlay: OverlayKind;
    entrance: EntranceKind;
    hover: HoverKind;
    speed: number;
    glow: number;
    smoothScroll: boolean;
    scrollbar: boolean;
  };
  customCss: string;
}

export const MAX_CUSTOM_CSS = 60000;
export const MAX_EXTRA_VARS = 60;
export const ASSET_URL_PREFIX = '/theme-assets/';

export function getDefaultTheme(): Theme {
  return {
    enabled: false,
    colors: { ...DEFAULT_COLORS },
    extraVars: [],
    background: { type: 'color', from: '#050505', to: '#12002b', angle: 160, imageUrl: '', size: 'cover', fixed: true, dim: 40, css: '' },
    fonts: { heading: '', body: '', mono: '', google: [], custom: [], baseSize: null, plainHeadings: false },
    shape: { radius: null },
    effects: { overlay: 'none', entrance: 'none', hover: 'none', speed: 1, glow: 0, smoothScroll: false, scrollbar: false },
    customCss: '',
  };
}

/* ---------- пресеты ---------- */

export const THEME_PRESETS: { id: string; label: string; colors: Partial<ThemeColors> }[] = [
  { id: 'neon', label: 'Неон (по умолчанию)', colors: { ...DEFAULT_COLORS } },
  { id: 'violet', label: 'Фиолетовая ночь', colors: { accent: '#a855f7', accentHover: '#9333ea', onAccent: '#ffffff', bg: '#0a0612', surface: '#120b1f', deep: '#05030a', text: '#f5efff', muted: '#a99bc4' } },
  { id: 'matrix', label: 'Матрица', colors: { accent: '#22ff66', accentHover: '#16d950', onAccent: '#001a08', bg: '#020a05', surface: '#05140a', deep: '#000000', text: '#d9ffe6', muted: '#7fb394' } },
  { id: 'sunset', label: 'Закат', colors: { accent: '#ff7a45', accentHover: '#ff5f1f', onAccent: '#1a0900', bg: '#140a0c', surface: '#1e1013', deep: '#080304', text: '#fff1e8', muted: '#c9a79a' } },
  { id: 'paper', label: 'Светлая бумага', colors: { accent: '#2563eb', accentHover: '#1d4ed8', onAccent: '#ffffff', bg: '#f6f5f1', surface: '#ffffff', deep: '#e7e4dc', text: '#14161a', muted: '#5b6068', success: '#15803d', warning: '#b45309', danger: '#b91c1c' } },
];

/* ---------- санитайзеры ---------- */

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;
}

const URL_OK = /^(https:\/\/[^\s)"'\\]+|\/theme-assets\/[A-Za-z0-9._-]+)$/;

/** Значение CSS-свойства: без ; {} <> \ @ кавычек; url() — только https или /theme-assets/. */
export function cssValue(v: unknown, max = 200): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s || s.length > max) return '';
  if (/[;{}<>\\@"'`\u0000-\u001f]/.test(s)) return '';
  if (/expression\s*\(|javascript:|behavior\s*:/i.test(s)) return '';
  const urls = s.match(/url\s*\(([^)]*)\)/gi) ?? [];
  for (const u of urls) {
    const inner = u.replace(/^url\s*\(/i, '').replace(/\)$/, '').trim();
    if (!URL_OK.test(inner)) return '';
  }
  return s;
}

/** Цвет: то же, что cssValue, но url() не допускается вообще. */
export function cssColor(v: unknown, fallback: string): string {
  const s = cssValue(v, 120);
  if (!s || /url\s*\(/i.test(s)) return fallback;
  return s;
}

export function sanitizeAssetUrl(v: unknown): string {
  return typeof v === 'string' && /^\/theme-assets\/[A-Za-z0-9._-]{1,100}$/.test(v) ? v : '';
}

function sanitizeBgImageUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim().slice(0, 500);
  return URL_OK.test(s) ? s : '';
}

const FAMILY_RE = /[^\p{L}\p{N} _-]/gu;
export function sanitizeFamily(v: unknown): string {
  return typeof v === 'string' ? v.replace(FAMILY_RE, '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
}

function sanitizeWeights(v: unknown): string {
  const nums = String(v ?? '')
    .split(/[;,\s]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n >= 100 && n <= 900 && n % 100 === 0);
  const uniq = [...new Set(nums)].sort((a, b) => a - b).slice(0, 9);
  return (uniq.length ? uniq : [400, 700]).join(';');
}

export function sanitizeTheme(input: unknown): Theme {
  const def = getDefaultTheme();
  const s = input && typeof input === 'object' ? (input as any) : {};

  const colors = { ...def.colors };
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    colors[key] = cssColor(s.colors?.[key], def.colors[key]);
  }

  const extraVars: ThemeExtraVar[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(s.extraVars) ? s.extraVars.slice(0, MAX_EXTRA_VARS) : []) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!/^--[A-Za-z0-9_-]{1,60}$/.test(name) || seen.has(name)) continue;
    const value = cssValue(item?.value, 200);
    if (!value) continue;
    seen.add(name);
    extraVars.push({ name, value });
  }

  const bg = s.background ?? {};
  const fonts = s.fonts ?? {};
  const ef = s.effects ?? {};

  const google: GoogleFont[] = [];
  for (const g of Array.isArray(fonts.google) ? fonts.google.slice(0, 6) : []) {
    const name = typeof g?.name === 'string' ? g.name.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (name) google.push({ name, weights: sanitizeWeights(g?.weights) });
  }

  const custom: CustomFont[] = [];
  const usedIds = new Set<string>();
  for (const f of Array.isArray(fonts.custom) ? fonts.custom.slice(0, 12) : []) {
    const family = sanitizeFamily(f?.family);
    const url = sanitizeAssetUrl(f?.url);
    if (!family || !url || !/\.(woff2|woff|ttf|otf)$/i.test(url)) continue;
    let id = typeof f?.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(f.id) ? f.id : `f${custom.length}${Math.random().toString(36).slice(2, 6)}`;
    while (usedIds.has(id)) id += 'x';
    usedIds.add(id);
    custom.push({ id, family, url, weight: clampNum(Math.round(Number(f?.weight) / 100) * 100, 100, 900, 400), style: f?.style === 'italic' ? 'italic' : 'normal' });
  }

  const radius = s.shape?.radius;

  return {
    enabled: Boolean(s.enabled),
    colors,
    extraVars,
    background: {
      type: oneOf(bg.type, ['color', 'gradient', 'image', 'css'] as const, 'color'),
      from: cssColor(bg.from, def.background.from),
      to: cssColor(bg.to, def.background.to),
      angle: Math.round(clampNum(bg.angle, 0, 360, 160)),
      imageUrl: sanitizeBgImageUrl(bg.imageUrl),
      size: oneOf(bg.size, ['cover', 'contain', 'auto'] as const, 'cover'),
      fixed: bg.fixed !== false,
      dim: Math.round(clampNum(bg.dim, 0, 90, 40)),
      css: cssValue(bg.css, 800),
    },
    fonts: {
      heading: sanitizeFamily(fonts.heading),
      body: sanitizeFamily(fonts.body),
      mono: sanitizeFamily(fonts.mono),
      google,
      custom,
      baseSize: fonts.baseSize == null || fonts.baseSize === '' ? null : Math.round(clampNum(fonts.baseSize, 12, 22, 16)),
      plainHeadings: Boolean(fonts.plainHeadings),
    },
    shape: { radius: radius == null || radius === '' ? null : Math.round(clampNum(radius, 0, 40, 4)) },
    effects: {
      overlay: oneOf(ef.overlay, ['none', 'grid', 'noise', 'scanlines', 'aurora'] as const, 'none'),
      entrance: oneOf(ef.entrance, ['none', 'fade', 'fade-up', 'zoom', 'slide'] as const, 'none'),
      hover: oneOf(ef.hover, ['none', 'lift', 'glow', 'scale'] as const, 'none'),
      speed: Math.round(clampNum(ef.speed, 0.25, 3, 1) * 100) / 100,
      glow: Math.round(clampNum(ef.glow, 0, 60, 0)),
      smoothScroll: Boolean(ef.smoothScroll),
      scrollbar: Boolean(ef.scrollbar),
    },
    customCss: typeof s.customCss === 'string' ? s.customCss.slice(0, MAX_CUSTOM_CSS) : '',
  };
}

/* ---------- генератор CSS ---------- */

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded']);
const FALLBACK_SANS = 'ui-sans-serif, system-ui, sans-serif';
const FALLBACK_MONO = 'ui-monospace, SFMono-Regular, monospace';

function stack(family: string, fallback: string): string {
  const f = GENERIC_FAMILIES.has(family.toLowerCase()) ? family.toLowerCase() : `"${family}"`;
  return `${f}, ${fallback}`;
}

function mix(a: string, pct: number, b: string): string {
  return `color-mix(in srgb, ${a} ${pct}%, ${b})`;
}

export interface BuildOptions {
  /** CSS-селектор области (предпросмотр). Без него тема применяется ко всему документу. */
  scope?: string;
  /**
   * Локальный @font-face для Google-шрифта (сервер скачивает и кэширует его, см. googleFonts.ts).
   * Без резолвера Google-шрифты не подключаются: внешний @import запрещён CSP и передавал бы IP посетителя Google.
   */
  resolveGoogleFont?: (font: GoogleFont) => string | null;
}

export function buildThemeCss(theme: Theme, opts: BuildOptions = {}): string {
  if (!theme.enabled) return '';
  const scope = opts.scope;
  // :root:root — повышенная специфичность, чтобы значения по умолчанию из index.css не перекрывали тему независимо от порядка подключения
  const root = scope ?? ':root:root';
  const body = scope ?? ':root:root body';
  const inScope = (sel: string) => (scope ? `${scope} ${sel}` : sel);
  const out: string[] = [];
  const c = theme.colors;
  const f = theme.fonts;
  const e = theme.effects;
  const bgc = theme.background;

  for (const g of f.google) {
    const local = opts.resolveGoogleFont?.(g);
    if (local) out.push(local);
  }
  for (const cf of f.custom) {
    const fmt = cf.url.endsWith('.woff2') ? 'woff2' : cf.url.endsWith('.woff') ? 'woff' : cf.url.endsWith('.otf') ? 'opentype' : 'truetype';
    out.push(`@font-face{font-family:"${cf.family}";src:url("${cf.url}") format("${fmt}");font-weight:${cf.weight};font-style:${cf.style};font-display:swap;}`);
  }

  // переменные и палитра Tailwind
  const vars: string[] = [
    `--cb-accent:${c.accent}`, `--cb-accent-hover:${c.accentHover}`, `--cb-on-accent:${c.onAccent}`,
    `--cb-bg:${c.bg}`, `--cb-surface:${c.surface}`, `--cb-deep:${c.deep}`, `--cb-text:${c.text}`, `--cb-muted:${c.muted}`,
    `--cb-success:${c.success}`, `--cb-warning:${c.warning}`, `--cb-danger:${c.danger}`,
    `--cb-speed:${e.speed}`,
    '--color-white:var(--cb-text)', '--color-black:var(--cb-deep)',
    `--color-neutral-100:${mix('var(--cb-text)', 89, 'var(--cb-muted)')}`,
    `--color-neutral-200:${mix('var(--cb-text)', 72, 'var(--cb-muted)')}`,
    `--color-neutral-300:${mix('var(--cb-text)', 53, 'var(--cb-muted)')}`,
    '--color-neutral-400:var(--cb-muted)',
    `--color-neutral-500:${mix('var(--cb-muted)', 70, 'var(--cb-bg)')}`,
    `--color-neutral-600:${mix('var(--cb-muted)', 49, 'var(--cb-bg)')}`,
    `--color-neutral-700:${mix('var(--cb-muted)', 37, 'var(--cb-bg)')}`,
    `--color-neutral-800:${mix('var(--cb-muted)', 21, 'var(--cb-bg)')}`,
    `--color-neutral-900:${mix('var(--cb-muted)', 11, 'var(--cb-bg)')}`,
  ];
  for (const [prefix, token] of [['red', 'danger'], ['emerald', 'success'], ['green', 'success'], ['amber', 'warning'], ['yellow', 'warning']] as const) {
    vars.push(
      `--color-${prefix}-300:${mix(`var(--cb-${token})`, 75, 'white')}`,
      `--color-${prefix}-400:var(--cb-${token})`,
      `--color-${prefix}-500:${mix(`var(--cb-${token})`, 90, 'black')}`,
      `--color-${prefix}-600:${mix(`var(--cb-${token})`, 78, 'black')}`,
    );
  }
  if (theme.shape.radius != null) {
    const r = theme.shape.radius;
    vars.push(`--radius-xs:${Math.round(r * 0.5)}px`, `--radius-sm:${r}px`, `--radius-md:${Math.round(r * 1.5)}px`, `--radius-lg:${Math.round(r * 2)}px`, `--radius-xl:${Math.round(r * 2.5)}px`, `--radius-2xl:${Math.round(r * 3.5)}px`);
  }
  if (f.body) vars.push(`--font-sans:${stack(f.body, FALLBACK_SANS)}`);
  if (f.mono) vars.push(`--font-mono:${stack(f.mono, FALLBACK_MONO)}`);
  if (f.heading) vars.push(`--font-display:${stack(f.heading, f.body ? stack(f.body, FALLBACK_SANS) : FALLBACK_SANS)}`);
  for (const v of theme.extraVars) vars.push(`${v.name}:${v.value}`);
  out.push(`${root}{${vars.join(';')};}`);

  // типографика
  if (f.baseSize && !scope) out.push(`html{font-size:${f.baseSize}px;}`);
  if (f.body) out.push(`${body}, ${inScope('.font-sans')}{font-family:${stack(f.body, FALLBACK_SANS)};}`);
  if (f.mono) out.push(`${inScope('.font-mono')}{font-family:${stack(f.mono, FALLBACK_MONO)};}`);
  if (f.heading) out.push(`${inScope('h1')}, ${inScope('h2')}, ${inScope('h3')}, ${inScope('h4')}, ${inScope('.font-display')}{font-family:${stack(f.heading, f.body ? stack(f.body, FALLBACK_SANS) : FALLBACK_SANS)};}`);
  if (f.plainHeadings) out.push(`${inScope('h1')}, ${inScope('h2')}, ${inScope('h3')}, ${inScope('h4')}{text-transform:none !important;font-style:normal !important;letter-spacing:normal !important;}`);

  // фон
  let bgRule = '';
  if (bgc.type === 'color') bgRule = `background:var(--cb-bg);`;
  else if (bgc.type === 'gradient') bgRule = `background:linear-gradient(${bgc.angle}deg, ${bgc.from}, ${bgc.to});${bgc.fixed && !scope ? 'background-attachment:fixed;' : ''}`;
  else if (bgc.type === 'css') bgRule = bgc.css ? `background:${bgc.css};` : `background:var(--cb-bg);`;
  else if (bgc.type === 'image') {
    if (bgc.imageUrl) {
      bgRule = `background-color:var(--cb-bg);background-image:linear-gradient(color-mix(in srgb, var(--cb-bg) ${bgc.dim}%, transparent), color-mix(in srgb, var(--cb-bg) ${bgc.dim}%, transparent)), url("${bgc.imageUrl}");background-size:cover, ${bgc.size};background-position:center;background-repeat:no-repeat;${bgc.fixed && !scope ? 'background-attachment:fixed;' : ''}`;
    } else bgRule = `background:var(--cb-bg);`;
  }
  out.push(`${scope ? scope : ':root:root, :root:root body'}{${bgRule}color:var(--cb-text);}`);
  if (bgc.type !== 'color') out.push(`${inScope('.cb-root')}{background:transparent !important;}`);

  // эффекты
  const overlayBase = scope ? 'position:absolute;inset:0;z-index:1;' : 'position:fixed;inset:0;z-index:1;';
  if (scope) out.push(`${scope}{position:relative;isolation:isolate;}`);
  const overlaySel = `${body}::before`;
  switch (e.overlay) {
    case 'grid':
      out.push(`${overlaySel}{content:"";${overlayBase}pointer-events:none;opacity:.5;background-image:linear-gradient(color-mix(in srgb, var(--cb-text) 6%, transparent) 1px, transparent 1px),linear-gradient(90deg, color-mix(in srgb, var(--cb-text) 6%, transparent) 1px, transparent 1px);background-size:44px 44px;}`);
      break;
    case 'noise':
      out.push(`${overlaySel}{content:"";${overlayBase}pointer-events:none;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");}`);
      break;
    case 'scanlines':
      out.push(`${overlaySel}{content:"";${overlayBase}pointer-events:none;opacity:.35;background:repeating-linear-gradient(0deg, color-mix(in srgb, var(--cb-deep) 55%, transparent) 0 1px, transparent 1px 3px);}`);
      break;
    case 'aurora':
      out.push(`${overlaySel}{content:"";${overlayBase}pointer-events:none;opacity:.22;filter:blur(60px);background:radial-gradient(40% 35% at 20% 25%, var(--cb-accent), transparent 70%),radial-gradient(35% 40% at 80% 70%, color-mix(in srgb, var(--cb-accent) 50%, #a855f7), transparent 70%);background-size:140% 140%;}`);
      break;
    default:
      break;
  }

  const motion: string[] = [];
  const dur = `calc(.7s / var(--cb-speed))`;
  if (e.entrance !== 'none') {
    const kf = { fade: 'from{opacity:0}to{opacity:1}', 'fade-up': 'from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}', zoom: 'from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}', slide: 'from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}' }[e.entrance];
    motion.push(`@keyframes cb-enter{${kf}}`);
    motion.push(`${inScope('main > *')}{animation:cb-enter ${dur} cubic-bezier(.2,.7,.2,1) both;}`);
  }
  if (e.overlay === 'aurora') {
    motion.push(`@keyframes cb-aurora{0%{background-position:0% 0%}50%{background-position:100% 100%}100%{background-position:0% 0%}}`);
    motion.push(`${overlaySel}{animation:cb-aurora calc(18s / var(--cb-speed)) ease-in-out infinite;}`);
  }
  if (e.hover !== 'none') {
    const hov = { lift: 'transform:translateY(-4px);', glow: 'box-shadow:0 0 28px color-mix(in srgb, var(--cb-accent) 35%, transparent);', scale: 'transform:scale(1.02);' }[e.hover];
    motion.push(`${inScope('.group')}{transition:transform calc(.25s / var(--cb-speed)), box-shadow calc(.25s / var(--cb-speed));}`);
    motion.push(`${inScope('.group')}:hover{${hov}}`);
  }
  if (motion.length) out.push(`@media (prefers-reduced-motion: no-preference){${motion.join('')}}`);

  if (e.glow > 0) out.push(`${inScope('.bg-cb-accent')}{box-shadow:0 0 ${e.glow}px color-mix(in srgb, var(--cb-accent) 45%, transparent);}`);
  if (e.smoothScroll && !scope) out.push('html{scroll-behavior:smooth;}');
  if (e.scrollbar && !scope) out.push(`*{scrollbar-color:var(--cb-accent) var(--cb-bg);scrollbar-width:thin;}::selection{background:var(--cb-accent);color:var(--cb-on-accent);}`);

  // свой CSS администратора
  const custom = theme.customCss.trim();
  if (custom) out.push(scope ? `${scope}{\n${custom}\n}` : custom);

  return out.join('\n');
}
