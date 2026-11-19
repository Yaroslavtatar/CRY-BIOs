import DOMPurify from 'dompurify';

/** Блок `html` — пользовательский контент: без скриптов, обработчиков событий, форм, iframe, <style>. */
export function sanitizeUserHtml(html: string): string {
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'svg', 'math', 'template', 'noscript'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'action', 'id', 'name'],
    ALLOW_DATA_ATTR: false,
  });
}

const EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'player.vimeo.com',
];

/** iframe-эмбеды: только https и известные плееры. */
export function isSafeEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Ссылки из профиля: http(s), mailto, tel; всё остальное (javascript:, data:) превращается в «#». */
export function safeHref(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^(\/|#)/.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '#';
  return `https://${trimmed}`;
}
