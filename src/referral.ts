/** Клиентская часть рефералок: ловим ?ref=код из рекламной ссылки, считаем переход и помним код 30 дней. */

const KEY = 'cry_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REF_RE = /^[a-z0-9_-]{3,32}$/;

export function getStoredRef(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return '';
    const { code, ts } = JSON.parse(raw) as { code: string; ts: number };
    if (typeof code !== 'string' || !REF_RE.test(code) || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return '';
    }
    return code;
  } catch {
    return '';
  }
}

/** Вызывается один раз при загрузке приложения. */
export function captureRef(): void {
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get('ref') || '').trim().toLowerCase();
    if (!REF_RE.test(code)) return;
    // Последняя рекламная ссылка перезаписывает прежнюю
    localStorage.setItem(KEY, JSON.stringify({ code, ts: Date.now() }));
    fetch('/api/ref/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => undefined);
    url.searchParams.delete('ref');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    /* localStorage/URL могут быть недоступны — реферал просто не засчитается на клиенте */
  }
}
