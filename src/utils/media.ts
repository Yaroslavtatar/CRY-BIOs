import { resolveMediaUrl } from './cdn';

/** Resolve thumbnail URL for locally uploaded avatars */
export function getThumbUrl(avatarUrl: string, cdnBase?: string | null): string {
  const resolved = resolveMediaUrl(avatarUrl, cdnBase);
  if (!avatarUrl?.startsWith('/uploads/') || avatarUrl.includes('/thumbs/')) {
    return resolved;
  }
  const filename = avatarUrl.split('/').pop() ?? '';
  const base = filename.replace(/\.[^.]+$/, '');
  return resolveMediaUrl(`/uploads/thumbs/${base}.webp`, cdnBase);
}
