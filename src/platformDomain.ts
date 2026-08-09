/**
 * Platform domain helpers — shared by server and client.
 * Resolves wildcard subdomains (name.cbios.ru) and builds profile URLs.
 */

export const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'dashboard',
  'uploads',
  'static',
  'assets',
  'mail',
  'ftp',
  'cdn',
  'u',
  'bio',
]);

export type ProfileUrlMode = 'subdomain' | 'path';

export interface PlatformDomainConfig {
  appUrl: string;
  baseDomain: string;
  profileUrlMode: ProfileUrlMode;
}

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

export function normalizeSlug(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 32 && SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function resolveBaseDomain(env: {
  bioBaseDomain?: string;
  appUrl?: string;
  requestHost?: string;
}): string {
  const fromEnv = env.bioBaseDomain?.toLowerCase().trim();
  if (fromEnv) return fromEnv.replace(/^\.+|\.+$/g, '');

  const fromAppUrl = env.appUrl ? hostnameFromUrl(env.appUrl) : '';
  if (fromAppUrl && fromAppUrl !== 'localhost') return fromAppUrl;

  const host = env.requestHost?.toLowerCase().split(':')[0] || '';
  if (!host || host === 'localhost' || host === '127.0.0.1') return host;

  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts.slice(-2).join('.');
  }
  return host;
}

export function resolveAppUrl(env: {
  appUrl?: string;
  requestHost?: string;
  baseDomain?: string;
}): string {
  const explicit = env.appUrl?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      return u.origin;
    } catch {
      /* fall through */
    }
  }

  const host = env.requestHost?.split(':')[0] || env.baseDomain || 'localhost';
  const protocol = host === 'localhost' || host === '127.0.0.1' ? 'http' : 'https';
  const port =
    typeof window !== 'undefined' && window.location.port && !['80', '443'].includes(window.location.port)
      ? `:${window.location.port}`
      : typeof process !== 'undefined' && process.env?.PORT && host === 'localhost'
        ? `:${process.env.PORT}`
        : '';
  return `${protocol}://${host}${port}`;
}

export function getPlatformDomainConfig(env: {
  bioBaseDomain?: string;
  appUrl?: string;
  requestHost?: string;
}): PlatformDomainConfig {
  const baseDomain = resolveBaseDomain(env);
  const appUrl = resolveAppUrl({ appUrl: env.appUrl, requestHost: env.requestHost, baseDomain });
  const profileUrlMode: ProfileUrlMode =
    baseDomain && baseDomain !== 'localhost' && baseDomain !== '127.0.0.1' ? 'subdomain' : 'path';
  return { appUrl, baseDomain, profileUrlMode };
}

/** Extract profile slug from hostname like alex.cbios.ru */
export function parseSubdomainSlug(hostname: string, baseDomain: string): string | null {
  const host = hostname.toLowerCase().split(':')[0];
  const base = baseDomain.toLowerCase();

  if (!host || !base || host === base || host === `www.${base}`) return null;

  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return null;

  const subPart = host.slice(0, -suffix.length);
  if (!subPart || subPart.includes('.')) return null;

  const slug = subPart.toLowerCase();
  if (isReservedSlug(slug) || !isValidSlug(slug)) return null;
  return slug;
}

/** Parse short path /alex on apex domain */
export function parseShortPathSlug(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!path.startsWith('/') || path === '/') return null;

  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 1) return null;

  const slug = segments[0].toLowerCase();
  if (isReservedSlug(slug) || !isValidSlug(slug)) return null;
  return slug;
}

export function getPrimaryProfileSlug(username: string, aliasSlug?: string): string {
  const alias = aliasSlug ? normalizeSlug(aliasSlug) : '';
  if (alias && isValidSlug(alias) && !isReservedSlug(alias)) return alias;
  return normalizeSlug(username);
}

export interface ProfileUrls {
  primary: string;
  subdomain: string | null;
  shortPath: string;
  legacy: string;
  slug: string;
}

export function buildProfileUrls(
  username: string,
  config: PlatformDomainConfig,
  aliasSlug?: string,
): ProfileUrls {
  const slug = getPrimaryProfileSlug(username, aliasSlug);
  const { appUrl, baseDomain, profileUrlMode } = config;
  const legacy = `${appUrl}/u/${username}`;
  const shortPath = `${appUrl}/${slug}`;

  let subdomain: string | null = null;
  if (profileUrlMode === 'subdomain' && baseDomain && baseDomain !== 'localhost') {
    subdomain = `https://${slug}.${baseDomain}`;
  }

  const primary = subdomain || shortPath;
  return { primary, subdomain, shortPath, legacy, slug };
}

export function resolveHostToSlug(hostname: string, baseDomain: string): string | null {
  return parseSubdomainSlug(hostname, baseDomain);
}
