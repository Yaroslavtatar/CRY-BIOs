import type { CSSProperties } from 'react';
import type { BioConfig, CardStyle } from './types';

export const CARD_STYLES: { id: CardStyle; label: string; hint: string }[] = [
  { id: 'none', label: 'Без карточки', hint: 'Контент лежит прямо на фоне.' },
  { id: 'glass', label: 'Стекло', hint: 'Полупрозрачная панель с размытием фона.' },
  { id: 'solid', label: 'Плотная', hint: 'Тёмная непрозрачная панель.' },
  { id: 'outline', label: 'Контур', hint: 'Прозрачная панель с тонкой рамкой.' },
];

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const num = (v: unknown, fallback: number) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

export interface CardSettings {
  style: CardStyle;
  opacity: number;
  blur: number;
  radius: number;
  border: boolean;
  tilt: boolean;
  tiltStrength: number;
  glare: boolean;
  lift: boolean;
}

export function resolveCard(config: Partial<BioConfig> | null | undefined): CardSettings {
  const style = config?.cardStyle ?? 'none';
  return {
    style,
    opacity: clamp(num(config?.cardSurfaceOpacity, 0.55), 0.1, 0.95),
    blur: clamp(num(config?.cardBlur, 14), 0, 40),
    radius: clamp(num(config?.cardRadius, 24), 0, 48),
    border: config?.cardBorder !== false,
    tilt: !!config?.cardTilt,
    tiltStrength: clamp(num(config?.cardTiltStrength, 9), 2, 20),
    glare: !!config?.cardGlare,
    lift: !!config?.cardLift,
  };
}

/** Внешний вид поверхности карточки (фон, размытие, рамка, скругление). */
export function cardSurfaceStyle(c: CardSettings, accent = '#ffffff'): CSSProperties {
  const style: CSSProperties = {};
  if (c.style === 'none') {
    // Без поверхности: скругление нужно только блику
    if (c.glare) style.borderRadius = c.radius;
    return style;
  }
  style.borderRadius = c.radius;
  if (c.style === 'glass') {
    style.background = `rgba(255, 255, 255, ${(c.opacity * 0.16).toFixed(3)})`;
    style.backdropFilter = `blur(${c.blur}px) saturate(1.25)`;
    (style as Record<string, unknown>).WebkitBackdropFilter = `blur(${c.blur}px) saturate(1.25)`;
    if (c.border) style.border = '1px solid rgba(255, 255, 255, 0.16)';
  } else if (c.style === 'solid') {
    style.background = `rgba(10, 10, 14, ${c.opacity.toFixed(3)})`;
    if (c.blur > 0) {
      style.backdropFilter = `blur(${c.blur}px)`;
      (style as Record<string, unknown>).WebkitBackdropFilter = `blur(${c.blur}px)`;
    }
    if (c.border) style.border = '1px solid rgba(255, 255, 255, 0.08)';
  } else if (c.style === 'outline') {
    style.background = 'transparent';
    if (c.border) style.border = `1px solid ${accent}66`;
  }
  return style;
}

export interface TiltState {
  /** rotateX, градусы */
  rx: number;
  /** rotateY, градусы */
  ry: number;
  /** Положение блика, % */
  gx: number;
  gy: number;
}

export const TILT_REST: TiltState = { rx: 0, ry: 0, gx: 50, gy: 50 };

/**
 * Наклон карточки от положения курсора: сторона, на которую указывает курсор, «уходит» вглубь.
 * Курсор в центре — карточка ровная; у правого края rotateY > 0, у нижнего rotateX < 0.
 */
export function tiltFromPointer(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, strength: number): TiltState {
  if (rect.width <= 0 || rect.height <= 0) return TILT_REST;
  const px = clamp((clientX - rect.left) / rect.width, 0, 1);
  const py = clamp((clientY - rect.top) / rect.height, 0, 1);
  const round = (n: number) => Math.round(n * 100) / 100 + 0; // + 0: превращает -0 в 0
  return {
    ry: round((px - 0.5) * 2 * strength),
    rx: round(-(py - 0.5) * 2 * strength),
    gx: round(px * 100),
    gy: round(py * 100),
  };
}

export function cardGlareStyle(t: TiltState, radius: number, on: boolean): CSSProperties {
  return {
    borderRadius: radius,
    background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 38%, transparent 62%)`,
    opacity: on ? 1 : 0,
    transition: 'opacity 0.25s ease',
    mixBlendMode: 'overlay',
  };
}
