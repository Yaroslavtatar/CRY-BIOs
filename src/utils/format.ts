/** Короткие числа для счётчиков: 1 234 → «1,2 тыс.» */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return String(Math.floor(n));
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** «3 дня назад», «только что». Некорректная дата → пустая строка (UI просто не показывает её). */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return 'только что';
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(Math.round(diff / 60), 'minute');
}

/** Похож ли тег релиза на версию (v1.2.3, 2.0, 1.0.0-beta): иначе в интерфейсе лучше показать коммит */
export function isVersionTag(tag: string | null | undefined): boolean {
  return !!tag && /^v?\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?$/.test(tag.trim());
}
