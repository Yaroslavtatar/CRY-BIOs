import type { SocialLink } from '../types';

type Platform = SocialLink['platform'];

/** Домен → платформа. Сопоставление по суффиксу: m.vk.com тоже подходит к vk.com. */
const HOST_PLATFORMS: ReadonlyArray<readonly [string, Platform]> = [
  ['t.me', 'telegram'], ['telegram.me', 'telegram'], ['telegram.org', 'telegram'],
  ['discord.gg', 'discord'], ['discord.com', 'discord'], ['discordapp.com', 'discord'],
  ['github.com', 'github'], ['gitlab.com', 'gitlab'],
  ['youtube.com', 'youtube'], ['youtu.be', 'youtube'],
  ['steamcommunity.com', 'steam'], ['steampowered.com', 'steam'],
  ['spotify.com', 'spotify'], ['music.apple.com', 'applemusic'],
  ['twitter.com', 'twitter'], ['x.com', 'twitter'],
  ['instagram.com', 'instagram'], ['tiktok.com', 'tiktok'],
  ['twitch.tv', 'twitch'], ['kick.com', 'kick'],
  ['vk.com', 'vk'], ['vk.ru', 'vk'],
  ['reddit.com', 'reddit'], ['snapchat.com', 'snapchat'],
  ['facebook.com', 'facebook'], ['fb.com', 'facebook'],
  ['linkedin.com', 'linkedin'], ['threads.net', 'threads'],
  ['wa.me', 'whatsapp'], ['whatsapp.com', 'whatsapp'],
  ['soundcloud.com', 'soundcloud'], ['patreon.com', 'patreon'],
  ['roblox.com', 'roblox'], ['paypal.me', 'paypal'], ['paypal.com', 'paypal'],
  ['cash.app', 'cashapp'], ['venmo.com', 'venmo'],
  ['bsky.app', 'bluesky'], ['onlyfans.com', 'onlyfans'],
  ['pinterest.com', 'pinterest'], ['last.fm', 'lastfm'],
  ['buymeacoffee.com', 'buymeacoffee'], ['ko-fi.com', 'kofi'],
];

const SOCIAL_TYPE_NAMES: Record<string, Platform> = {
  telegram: 'telegram', discord: 'discord', github: 'github', gitlab: 'gitlab', youtube: 'youtube',
  steam: 'steam', spotify: 'spotify', twitter: 'twitter', x: 'twitter', instagram: 'instagram',
  tiktok: 'tiktok', twitch: 'twitch', kick: 'kick', vk: 'vk', reddit: 'reddit', snapchat: 'snapchat',
  facebook: 'facebook', linkedin: 'linkedin', threads: 'threads', whatsapp: 'whatsapp',
  soundcloud: 'soundcloud', patreon: 'patreon', bluesky: 'bluesky', pinterest: 'pinterest',
  email: 'email', lastfm: 'lastfm', kofi: 'kofi', buymeacoffee: 'buymeacoffee', paypal: 'paypal',
};

/** Разрешены только http(s) и mailto. javascript:, data: и прочее отбрасываются. */
export function sanitizeImportUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u001f\u007f\s]+/g, (m) => (m.includes(' ') ? ' ' : '')).trim();
  if (!value || value.length > 500) return null;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function platformFromUrl(url: string): Platform {
  if (/^mailto:/i.test(url)) return 'email';
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    for (const [domain, platform] of HOST_PLATFORMS) {
      if (host === domain || host.endsWith(`.${domain}`)) return platform;
    }
  } catch {
    /* не URL */
  }
  return 'website';
}

/** Платформа по названию типа у источника (INSTAGRAM, "x"…) с запасным вариантом по ссылке. */
export function platformFromTypeOrUrl(type: unknown, url: string): Platform {
  if (typeof type === 'string') {
    const key = type.toLowerCase().replace(/[^a-z]/g, '');
    if (SOCIAL_TYPE_NAMES[key]) return SOCIAL_TYPE_NAMES[key];
  }
  return platformFromUrl(url);
}

/** Ключ для сравнения ссылок: без схемы, www, хвостового слеша, query и регистра. */
export function linkKey(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'mailto:') return `mailto:${u.pathname.toLowerCase()}`;
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}

export function cleanImportText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

export function buildSocialLinks(
  entries: ReadonlyArray<{ url: unknown; type?: unknown; label?: unknown }>,
  idPrefix: string,
  max = 30,
): SocialLink[] {
  const seen = new Set<string>();
  const out: SocialLink[] = [];
  for (const e of entries) {
    const url = sanitizeImportUrl(e.url);
    if (!url) continue;
    const key = linkKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const platform = platformFromTypeOrUrl(e.type, url);
    const label = cleanImportText(e.label, 60);
    out.push({ id: `${idPrefix}-${out.length + 1}`, platform, url, ...(platform === 'website' && label ? { label } : {}) });
    if (out.length >= max) break;
  }
  return out;
}
