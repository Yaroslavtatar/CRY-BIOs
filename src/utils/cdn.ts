let clientMediaCdnUrl: string | null = null;

export function setClientMediaCdnUrl(url: string | null | undefined) {
  clientMediaCdnUrl = url?.trim() || null;
}

export function getClientMediaCdnUrl(): string | null {
  return clientMediaCdnUrl;
}

export function getServerMediaCdnUrl(): string | null {
  const url = process.env.MEDIA_CDN_URL?.trim();
  return url || null;
}

export function resolveMediaUrl(url: string | undefined, cdnBase?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = cdnBase ?? clientMediaCdnUrl;
  if (base && url.startsWith('/uploads/')) {
    return `${base.replace(/\/$/, '')}${url}`;
  }
  return url;
}

export function isMediaSameOrigin(url: string, cdnBase?: string | null): boolean {
  if (!url) return true;
  if (url.startsWith('/')) return true;
  const base = cdnBase ?? clientMediaCdnUrl;
  if (base && url.startsWith(base)) return true;
  try {
    return url.startsWith(window.location.origin);
  } catch {
    return false;
  }
}
