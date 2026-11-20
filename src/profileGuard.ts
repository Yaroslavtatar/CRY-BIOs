import type { BioConfig } from './types';
import { sanitizeCanvas } from './canvasLayout';

/** Поля профиля, которые клиент менять не может: их ставит только сервер/админ. */
const PROTECTED_BADGE_TYPES = new Set(['verified', 'staff']);
const IMPERSONATION_RE = /official|staff|admin|support|moderator|\bteam\b|verified|owner|cry\s*team|cbios|crybios/i;
const MAX_CUSTOM_BADGE = 20;

export interface GuardResult {
  ok: boolean;
  error?: string;
}

/**
 * Применяет серверные ограничения к клиентскому payload профиля (мутирует payload).
 * Серверные поля всегда берутся из сохранённой версии, а не из тела запроса.
 */
export function guardProfilePayload(payload: Partial<BioConfig> & Record<string, any>, stored: BioConfig | null | undefined): GuardResult {
  // verified / uid / customDomain — только из сохранённого профиля
  payload.verified = stored?.verified === true;

  if (stored?.uid !== undefined) payload.uid = stored.uid;
  else delete payload.uid;

  if (stored?.customDomain !== undefined) payload.customDomain = stored.customDomain;
  else delete payload.customDomain;

  // customBadge: короткий, без имитации статуса команды (если значение не менялось — оставляем)
  if (typeof payload.customBadge !== 'string') {
    payload.customBadge = stored?.customBadge ?? 'USER';
  } else {
    payload.customBadge = payload.customBadge.trim().slice(0, MAX_CUSTOM_BADGE);
    const changed = payload.customBadge !== (stored?.customBadge ?? '');
    if (changed && IMPERSONATION_RE.test(payload.customBadge)) {
      return { ok: false, error: 'Этот текст бейджа зарезервирован' };
    }
  }

  // Бейджи типов verified/staff: только уже выданные ранее
  if (Array.isArray(payload.badges)) {
    const storedProtected = (stored?.badges || []).filter(b => PROTECTED_BADGE_TYPES.has(b.type));
    const storedIds = new Set(storedProtected.map(b => b.id));
    payload.badges = payload.badges.filter(b => !PROTECTED_BADGE_TYPES.has(b?.type) || storedIds.has(b.id));
    for (const sb of storedProtected) {
      if (!payload.badges.some(b => b.id === sb.id)) payload.badges.push(sb);
    }
  }

  // canvas: только числа в разумных пределах и безопасные ключи
  if ('canvas' in payload) {
    const canvas = sanitizeCanvas(payload.canvas);
    if (canvas) payload.canvas = canvas;
    else delete payload.canvas;
  }

  return { ok: true };
}

const HOST_RE = /^[a-z0-9.-]{1,253}$/;

/** Нормализация host из аналитики: только допустимый hostname, не длиннее 253 символов. */
export function sanitizeVisitHost(raw: unknown, fallback: string): string {
  const candidate = typeof raw === 'string' ? raw.toLowerCase().trim().split(':')[0] : '';
  if (candidate && HOST_RE.test(candidate)) return candidate;
  const fb = (fallback || '').toLowerCase().split(':')[0].slice(0, 253);
  return HOST_RE.test(fb) ? fb : 'unknown';
}
