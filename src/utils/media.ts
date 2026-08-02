/** Resolve thumbnail URL for locally uploaded avatars */
export function getThumbUrl(avatarUrl: string): string {
  if (!avatarUrl?.startsWith('/uploads/') || avatarUrl.includes('/thumbs/')) {
    return avatarUrl;
  }
  const filename = avatarUrl.split('/').pop() ?? '';
  const base = filename.replace(/\.[^.]+$/, '');
  return `/uploads/thumbs/${base}.webp`;
}
