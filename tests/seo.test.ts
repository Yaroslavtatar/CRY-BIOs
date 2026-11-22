import { describe, it, expect } from 'vitest';
import { buildProfileMeta, injectProfileMeta, injectSiteMeta, buildSitemapXml, buildRobotsTxt, absoluteImageUrl, escapeHtml } from '../src/seo';
import type { BioConfig } from '../src/types';

const TEMPLATE = `<!doctype html><html><head>
<title>CRY BIOS</title>
<meta name="description" content="x" />
<meta property="og:title" content="x" />
<meta property="og:image" content="/og-default.png" />
<meta name="twitter:card" content="summary" />
</head><body></body></html>`;

const bio = (over: Partial<BioConfig> = {}) => ({ username: 'alex', displayName: 'Alex', bio: 'hello', avatarUrl: '/uploads/a.webp', ...over }) as BioConfig;

describe('seo', () => {
  it('экранирует значения в мета-тегах (защита от инъекции в HTML)', () => {
    const meta = buildProfileMeta({ bio: bio({ displayName: '"><script>alert(1)</script>', bio: '<b>x</b>' }), origin: 'https://cbios.ru', slug: 'alex' });
    const html = injectProfileMeta(TEMPLATE, meta);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('подставляет og/twitter/canonical для профиля', () => {
    const meta = buildProfileMeta({ bio: bio(), origin: 'https://cbios.ru', slug: 'alex' });
    const html = injectProfileMeta(TEMPLATE, meta);
    expect(html).toContain('<title>Alex | CRY BIOS</title>');
    expect(html).toContain('content="https://cbios.ru/uploads/a.webp"');
    expect(html).toContain('<link rel="canonical" href="https://cbios.ru/alex" />');
    expect(html).toContain('summary_large_image');
  });

  it('по умолчанию профиль закрыт от индексации, с searchIndexing=true открыт', () => {
    const closed = injectProfileMeta(TEMPLATE, buildProfileMeta({ bio: bio(), origin: 'https://cbios.ru', slug: 'alex' }));
    expect(closed).toContain('noindex');
    const open = injectProfileMeta(TEMPLATE, buildProfileMeta({ bio: bio({ searchIndexing: true }), origin: 'https://cbios.ru', slug: 'alex' }));
    expect(open).not.toContain('noindex');
  });

  it('SVG-аватар заменяется на PNG платформы (соцсети не показывают SVG)', () => {
    expect(absoluteImageUrl('/default-avatar.svg', 'https://cbios.ru')).toBe('https://cbios.ru/og-default.png');
    expect(absoluteImageUrl('https://cdn.example/x.jpg', 'https://cbios.ru')).toBe('https://cdn.example/x.jpg');
  });

  it('sitemap содержит страницы платформы и только переданные профили', () => {
    const xml = buildSitemapXml('https://cbios.ru', [{ slug: 'alex' }, { slug: 'a&b' }]);
    expect(xml).toContain('<loc>https://cbios.ru/</loc>');
    expect(xml).toContain('<loc>https://cbios.ru/alex</loc>');
    expect(xml).toContain('a&amp;b');
  });

  it('robots.txt ссылается на sitemap настроенного адреса', () => {
    expect(buildRobotsTxt('https://cbios.ru')).toContain('Sitemap: https://cbios.ru/sitemap.xml');
  });

  it('injectSiteMeta делает адрес картинки абсолютным', () => {
    const html = injectSiteMeta(TEMPLATE, 'https://cbios.ru');
    expect(html).toContain('content="https://cbios.ru/og-default.png"');
    expect(html).toContain('rel="canonical"');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});
