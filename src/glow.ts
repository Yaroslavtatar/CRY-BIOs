import type { CSSProperties } from 'react';
import type { BioConfig, GlowStyleId, GlowTarget } from './types';

export const GLOW_STYLES: { id: GlowStyleId; label: string; hint: string }[] = [
  { id: 'soft', label: 'Ровное', hint: 'Спокойное постоянное свечение.' },
  { id: 'pulse', label: 'Пульс', hint: 'Свечение быстро разгорается и затухает, как сердцебиение.' },
  { id: 'breathe', label: 'Дыхание', hint: 'Медленные плавные «вдох-выдох».' },
  { id: 'flicker', label: 'Мерцание', hint: 'Неоновая вывеска с перебоями.' },
  { id: 'rainbow', label: 'Радуга', hint: 'Цвет свечения плавно проходит весь спектр.' },
  { id: 'dual', label: 'Два цвета', hint: 'Свечение перетекает между первым и вторым цветом.' },
];

export const GLOW_TARGETS: GlowTarget[] = ['avatar', 'username', 'location', 'badges', 'links', 'card'];
export const DEFAULT_GLOW_TARGETS: GlowTarget[] = ['avatar', 'username', 'badges', 'links'];

const LEGACY_SIZE = { low: 8, medium: 16, high: 28 } as const;
const HEX = /^#[0-9a-f]{6}$/i;

export interface GlowSettings {
  color: string;
  color2: string;
  style: GlowStyleId;
  /** Радиус свечения, px */
  size: number;
  speed: number;
  targets: GlowTarget[];
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/**
 * Настройки подсветки или null, если она выключена.
 * Совместимо со старыми профилями: glowIntensity → размер, avatarGlowEnabled → свечение только аватара.
 */
export function resolveGlow(config: Partial<BioConfig> | null | undefined): GlowSettings | null {
  if (!config) return null;
  const general = !!config.glowEnabled;
  const avatarOnly = !general && !!config.avatarGlowEnabled;
  if (!general && !avatarOnly) return null;

  const color = config.glowColor && HEX.test(config.glowColor) ? config.glowColor : config.primaryColor && HEX.test(config.primaryColor) ? config.primaryColor : '#00f2ff';
  const color2 = config.glowColor2 && HEX.test(config.glowColor2) ? config.glowColor2 : color;
  const size = Number.isFinite(Number(config.glowSize)) && config.glowSize !== undefined
    ? clamp(Number(config.glowSize), 4, 44)
    : LEGACY_SIZE[config.glowIntensity || 'medium'] ?? 16;

  return {
    color,
    color2,
    style: config.glowStyle || 'soft',
    size,
    speed: clamp(Number.isFinite(Number(config.glowSpeed)) && config.glowSpeed !== undefined ? Number(config.glowSpeed) : 1, 0.3, 3),
    targets: avatarOnly ? ['avatar'] : config.glowTargets ?? DEFAULT_GLOW_TARGETS,
  };
}

export function glowAppliesTo(g: GlowSettings | null, target: GlowTarget): g is GlowSettings {
  return !!g && g.targets.includes(target);
}

/** CSS-переменные подсветки: цвета, радиус и скорость анимации. */
export function glowVars(g: GlowSettings): CSSProperties {
  return {
    ['--gl-c1' as string]: g.color,
    ['--gl-c2' as string]: g.color2,
    ['--gl-base' as string]: `${g.size}px`,
    ['--gl-v' as string]: g.speed,
  } as CSSProperties;
}

/** Классы подсветки: gl-fx (drop-shadow по форме содержимого), gl-box (box-shadow карточки), gl-links (на ссылки внутри). */
export function glowClass(g: GlowSettings, kind: 'fx' | 'box' | 'links'): string {
  return `gl gl-${kind} gl-s-${g.style}`;
}

/** Для обратной совместимости: статичные части подсветки, которые не зависят от обёртки. */
export function glowInlineStyle(g: GlowSettings | null, target: GlowTarget): CSSProperties {
  if (!glowAppliesTo(g, target)) return {};
  // тонкое кольцо вокруг аватара в цвет подсветки (цвет анимируется вместе со стилем)
  if (target === 'avatar') return { border: '2px solid var(--gl-c)' };
  return {};
}
