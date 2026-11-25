/**
 * Хосты, с которых импорт может скачивать картинки профилей.
 * Единый список для парсеров (не пропускать чужие ссылки) и для rehostMedia (что разрешено скачивать).
 */
export const TELEGRAM_CDN_HOST_RE = /^cdn\d*\.(?:cdn-telegram\.org|telesco\.pe)$/i;

export const LINKTREE_IMAGE_HOSTS: readonly string[] = ['ugc.production.linktr.ee', 'd1fdloi71mui9q.cloudfront.net'];

export const GITHUB_AVATAR_HOSTS: readonly string[] = ['avatars.githubusercontent.com'];

export function isImportMediaHost(host: string): boolean {
  const h = host.toLowerCase();
  return TELEGRAM_CDN_HOST_RE.test(h) || LINKTREE_IMAGE_HOSTS.includes(h) || GITHUB_AVATAR_HOSTS.includes(h);
}
