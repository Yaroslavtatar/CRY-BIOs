import type { CSSProperties } from 'react';
import type { NameEffect, BioConfig } from '../types';
import { getNameEffectEntry, type NameEffectAura } from './nameEffectCatalog';
import { DEFAULT_FX, clampSettings, type FxSettings } from '../fx/engine';

export interface NameEffectOptions {
  color?: string;
  color2?: string;
  speed?: number;
}

export function nameEffectOptions(config: Partial<BioConfig> | null | undefined): NameEffectOptions {
  return { color: config?.nameEffectColor, color2: config?.nameEffectColor2, speed: config?.nameEffectSpeed };
}

export function isSparkNameEffect(effect?: NameEffect): boolean {
  return !!getNameEffectEntry(effect)?.aura;
}

export function getAuraFx(effect: NameEffect | undefined, opts: NameEffectOptions = {}, count = 24): FxSettings | null {
  const aura: NameEffectAura | undefined = getNameEffectEntry(effect)?.aura;
  if (!aura) return null;
  const custom = opts.color && /^#[0-9a-f]{6}$/i.test(opts.color) ? opts.color : undefined;
  return clampSettings({
    ...DEFAULT_FX,
    type: aura.type,
    colorMode: aura.rainbow ? 'rainbow' : 'preset',
    palette: custom ? [custom] : aura.palette,
    speed: Math.min(3, Math.max(0.3, opts.speed ?? 1)),
    size: aura.type === 'snow' || aura.type === 'stars' ? 0.8 : aura.type === 'hearts' ? 0.5 : 1,
    sway: 0.8,
    count,
  });
}

/** Старые эффекты, у которых нет цветов/скорости: готовые Tailwind-классы и @keyframes из index.css */
function legacyClasses(effect: NameEffect | undefined): string {
  switch (effect) {
    case 'shine':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-500 to-white animate-shine bg-[length:200%_auto]';
    case 'glitch':
      return 'text-white animate-glitch-v2 relative';
    case 'shuffle':
      return 'text-white animate-shuffle inline-block';
    case 'fuzzy':
      return 'text-white animate-fuzzy inline-block';
    case 'rainbow':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 animate-rainbow bg-[length:200%_auto]';
    case 'flicker':
      return 'text-white animate-flicker-neon';
    case 'bounce':
      return 'text-white animate-bounce-subtle inline-block';
    case 'cyber':
      return 'text-cyan-300 animate-cyber tracking-widest uppercase';
    case 'blur_glitch':
      return 'text-white animate-blur-glitch inline-block relative';
    case 'shift':
      return 'text-white animate-shift inline-block';
    default:
      return 'text-white drop-shadow-md';
  }
}

export function getNameEffectClasses(effect: NameEffect | undefined, _displayName?: string): string {
  const entry = getNameEffectEntry(effect);
  if (entry?.cls) {
    // ауры: текст остаётся белым и читаемым, частицы рисуются отдельно
    return entry.aura ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] relative z-10' : entry.cls;
  }
  return legacyClasses(effect);
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Пользовательские цвета/скорость → CSS-переменные эффекта (--ne-a, --ne-b, --ne-s) */
export function getNameEffectStyle(effect: NameEffect | undefined, _displayName?: string, opts: NameEffectOptions = {}): CSSProperties | undefined {
  const entry = getNameEffectEntry(effect);
  if (!entry?.cls) return undefined;
  const style: Record<string, string | number> = {};
  const a = entry.a;
  const b = entry.b;
  // значения по умолчанию берём из каталога; пользовательские перекрывают их
  if (a) style['--ne-a'] = entry.colors && opts.color && HEX.test(opts.color) ? opts.color : a;
  if (b) style['--ne-b'] = (entry.colors ?? 0) >= 2 && opts.color2 && HEX.test(opts.color2) ? opts.color2 : b;
  if (entry.speed && opts.speed && opts.speed > 0) style['--ne-s'] = Math.min(3, Math.max(0.3, opts.speed));
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}
