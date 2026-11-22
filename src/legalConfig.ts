/**
 * Юридические данные оператора для страниц «Политика конфиденциальности» и «Условия использования».
 * Значения задаются в админ-панели (раздел «Юр. данные») и хранятся в data/legal_settings.json.
 * Этот файл — чистая логика без доступа к диску, её используют и сервер, и клиент.
 * Тексты в LegalPage.tsx являются шаблоном, а не юридической консультацией: покажите их юристу.
 */

export interface LegalSettings {
  /** Название сервиса в текстах (по умолчанию CRY BIOS) */
  siteName: string;
  /** Организационная форма: «ИП», «ООО», «Физическое лицо», «Самозанятый» и т.п. */
  operatorForm: string;
  /** ФИО или наименование оператора */
  operatorName: string;
  /** ИНН (или иной налоговый идентификатор) */
  taxId: string;
  /** ОГРН / ОГРНИП */
  regNumber: string;
  /** Адрес оператора */
  address: string;
  /** E-mail для обращений по данным и пользовательской поддержки */
  operatorContact: string;
  /** E-mail для жалоб на контент и нарушения (если отличается) */
  abuseContact: string;
  /** Применимое право / подсудность, например «Российская Федерация» */
  jurisdiction: string;
  /** Дата редакции, YYYY-MM-DD */
  lastUpdated: string;
  /** Показывать реквизиты оператора в подвале главной */
  showRequisitesInFooter: boolean;
  /** Дополнительные абзацы в конец Политики (абзацы разделяются пустой строкой) */
  privacyExtra: string;
  /** Дополнительные абзацы в конец Условий */
  termsExtra: string;
}

export const LEGAL_PLACEHOLDER_NAME = '[заполните: ФИО или наименование оператора]';
export const LEGAL_PLACEHOLDER_CONTACT = '[заполните: e-mail для обращений]';

export const DEFAULT_LEGAL: LegalSettings = {
  siteName: 'CRY BIOS',
  operatorForm: '',
  operatorName: LEGAL_PLACEHOLDER_NAME,
  taxId: '',
  regNumber: '',
  address: '',
  operatorContact: LEGAL_PLACEHOLDER_CONTACT,
  abuseContact: '',
  jurisdiction: '',
  lastUpdated: '2026-11-21',
  showRequisitesInFooter: false,
  privacyExtra: '',
  termsExtra: '',
};

const LIMITS: Record<keyof Omit<LegalSettings, 'showRequisitesInFooter' | 'lastUpdated'>, number> = {
  siteName: 60,
  operatorForm: 60,
  operatorName: 200,
  taxId: 40,
  regNumber: 40,
  address: 300,
  operatorContact: 120,
  abuseContact: 120,
  jurisdiction: 120,
  privacyExtra: 4000,
  termsExtra: 4000,
};

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Контакт: валидный e-mail либо пусто. Возвращает null, если значение некорректно. */
export function cleanEmail(value: unknown): string | null {
  const v = String(value ?? '').trim();
  if (!v) return '';
  return EMAIL_RE.test(v) && v.length <= 120 ? v : null;
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Убирает управляющие символы и обрезает по лимиту; переводы строк сохраняет только в многострочных полях. */
function cleanText(value: unknown, max: number, multiline = false): string {
  let s = typeof value === 'string' ? value : '';
  s = s.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  return s.trim().slice(0, max);
}

/** Приводит произвольный объект к валидным настройкам; пустые обязательные поля заменяются значениями по умолчанию. */
export function normalizeLegal(input: Partial<LegalSettings> | null | undefined): LegalSettings {
  const p = input ?? {};
  const email = (v: unknown, fallback: string) => {
    const c = cleanEmail(v);
    return c === null ? fallback : c;
  };
  return {
    siteName: cleanText(p.siteName, LIMITS.siteName) || DEFAULT_LEGAL.siteName,
    operatorForm: cleanText(p.operatorForm, LIMITS.operatorForm),
    operatorName: cleanText(p.operatorName, LIMITS.operatorName) || DEFAULT_LEGAL.operatorName,
    taxId: cleanText(p.taxId, LIMITS.taxId),
    regNumber: cleanText(p.regNumber, LIMITS.regNumber),
    address: cleanText(p.address, LIMITS.address),
    operatorContact: email(p.operatorContact, '') || DEFAULT_LEGAL.operatorContact,
    abuseContact: email(p.abuseContact, ''),
    jurisdiction: cleanText(p.jurisdiction, LIMITS.jurisdiction),
    lastUpdated: isValidIsoDate(p.lastUpdated) ? p.lastUpdated : DEFAULT_LEGAL.lastUpdated,
    showRequisitesInFooter: Boolean(p.showRequisitesInFooter),
    privacyExtra: cleanText(p.privacyExtra, LIMITS.privacyExtra, true),
    termsExtra: cleanText(p.termsExtra, LIMITS.termsExtra, true),
  };
}

/** Заполнены ли обязательные данные оператора (имя и e-mail заданы, не плейсхолдеры). */
export function isLegalConfigured(s: LegalSettings): boolean {
  return s.operatorName !== LEGAL_PLACEHOLDER_NAME && s.operatorContact !== LEGAL_PLACEHOLDER_CONTACT;
}

/** «ИП Иванов И. И.» / «ООО Ромашка» / просто имя. */
export function formatOperator(s: LegalSettings): string {
  return [s.operatorForm, s.operatorName].filter(Boolean).join(' ');
}

/** Реквизиты строками для подвала и страниц: ИНН, ОГРН, адрес. Пустые пропускаются. */
export function requisitesLines(s: LegalSettings): string[] {
  return [
    s.taxId ? `ИНН ${s.taxId}` : '',
    s.regNumber ? `ОГРН ${s.regNumber}` : '',
    s.address,
  ].filter(Boolean);
}

/** Многострочный текст → абзацы (разделитель — пустая строка). Это обычный текст, HTML не интерпретируется. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/** YYYY-MM-DD → «21.11.2026» */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

const CONTENT_KEYS: (keyof LegalSettings)[] = [
  'siteName', 'operatorForm', 'operatorName', 'taxId', 'regNumber', 'address',
  'operatorContact', 'abuseContact', 'jurisdiction', 'privacyExtra', 'termsExtra',
];

/** Изменился ли текст документов (не считая переключателя подвала и даты). */
export function legalContentChanged(a: LegalSettings, b: LegalSettings): boolean {
  return CONTENT_KEYS.some((k) => a[k] !== b[k]);
}
