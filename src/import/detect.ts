import type { ImportProviderId } from './catalog';

/** Подсказка: на какую платформу похожа вставленная ссылка. Нужна, чтобы не ловить ошибки «не та платформа». */
export function detectImportProvider(input: string): ImportProviderId | null {
  const v = input.trim();
  if (!v) return null;
  const host = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+)\//i.exec(v)?.[1]?.toLowerCase();
  if (host) {
    if (host === 'guns.lol') return 'guns';
    if (host === 'linktr.ee') return 'linktree';
    if (host === 't.me' || host === 'telegram.me') return 'telegram';
    if (host === 'github.com') return 'github';
  }
  if (v.length > 300) {
    if (/linktr\.ee/i.test(v)) return 'linktree';
    if (/guns\.lol/i.test(v)) return 'guns';
  }
  return null;
}
