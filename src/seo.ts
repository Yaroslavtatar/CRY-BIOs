/**
 * SEO-хелперы: серверные мета-теги профилей, robots.txt и sitemap.xml.
 * Чистые функции без доступа к БД и Express: их удобно тестировать.
 */
import type { BioConfig } from './types';

const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Абсолютный адрес картинки для og:image. SVG соцсети не показывают, поэтому для него берём PNG платформы. */
export function absoluteImageUrl(image: string | undefined, origin: string): string {
  const raw = (image || '').trim();
  if (!raw || /\.svg(\?|#|$)/i.test(raw) || raw.startsWith('data:')) return `${origin}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${origin}${raw}`;
  return `${origin}${DEFAULT_OG_IMAGE_PATH}`;
}

export interface ProfileMetaInput {
  bio: BioConfig;
  /** Адрес сайта без завершающего слэша, например https://cbios.ru */
  origin: string;
  /** Основной slug профиля (alias или username) */
  slug: string;
}

export interface ProfileMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  indexable: boolean;
}

/** Профиль индексируется только если его владелец явно разрешил (searchIndexing === true). */
export function isIndexable(bio: Pick<BioConfig, 'searchIndexing'>): boolean {
  return bio.searchIndexing === true;
}

export function buildProfileMeta({ bio, origin, slug }: ProfileMetaInput): ProfileMeta {
  const name = bio.displayName || bio.username;
  const title = clip(bio.ogTitle || bio.customPageTitle || `${name} | CRY BIOS`, 90);
  const description = clip(bio.ogDescription || bio.bio || `Профиль ${name} на CRY BIOS`, 200);
  return {
    title,
    description,
    image: absoluteImageUrl(bio.ogImage || bio.avatarUrl, origin),
    url: `${origin}/${slug}`,
    indexable: isIndexable(bio),
  };
}

function setTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, () => replacement) : html.replace('</head>', () => `    ${replacement}\n  </head>`);
}

/** Подставляет мета-теги профиля в шаблон index.html. Все значения экранируются. */
export function injectProfileMeta(template: string, meta: ProfileMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${d}" />`);
  html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="profile" />`);
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${t}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${d}" />`);
  html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${i}" />`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${u}" />`);
  html = setTag(html, /<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image" />`);
  html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${t}" />`);
  html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${d}" />`);
  html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${i}" />`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${u}" />`);
  if (!meta.indexable) {
    html = setTag(html, /<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex, nofollow" />`);
  }
  return html;
}

export function buildRobotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /dashboard\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export interface SitemapEntry {
  slug: string;
}

export function buildSitemapXml(origin: string, profiles: SitemapEntry[]): string {
  const urls = [
    `${origin}/`,
    `${origin}/privacy`,
    `${origin}/terms`,
    ...profiles.map((p) => `${origin}/${p.slug}`),
  ];
  const body = urls.map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}

/** Общие мета-теги платформы: абсолютные адреса картинок и canonical для главной страницы. */
export function injectSiteMeta(template: string, origin: string, canonicalPath = '/'): string {
  const abs = escapeHtml(`${origin}${DEFAULT_OG_IMAGE_PATH}`);
  let html = template.split(`content="${DEFAULT_OG_IMAGE_PATH}"`).join(`content="${abs}"`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(origin + canonicalPath)}" />`);
  return html;
}
