import type { CSSProperties } from 'react';
import { NameEffect } from '../types';

const SPARK_EFFECTS = new Set<NameEffect>([
  'sparks_blue', 'sparks_yellow', 'sparks_pink', 'sparks_red', 'sparks_white', 'sparks_gold',
]);

export function isSparkNameEffect(effect?: NameEffect): boolean {
  return !!effect && SPARK_EFFECTS.has(effect);
}

export function getNameEffectClasses(effect: NameEffect | undefined, displayName: string): string {
  const len = Math.max(displayName.length, 1);
  switch (effect) {
    case 'glow':
      return 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.85)]';
    case 'neon':
      return 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.95)] animate-neon-pulse';
    case 'neon_red':
      return 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.9)]';
    case 'neon_blue':
      return 'text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.9)]';
    case 'stroke':
      return 'text-transparent [-webkit-text-stroke:1.5px_white]';
    case 'gradient':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600';
    case 'gradient_fire':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500';
    case 'gradient_ocean':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-blue-500 to-cyan-400';
    case 'shine':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-500 to-white animate-shine bg-[length:200%_auto]';
    case 'glitch':
      return 'text-white animate-glitch-v2 relative';
    case 'shuffle':
      return 'text-white animate-shuffle inline-block';
    case 'fuzzy':
      return 'text-white animate-fuzzy inline-block';
    case 'typewriter':
      return `text-white overflow-hidden whitespace-nowrap border-r-[3px] border-white max-w-full sm:max-w-fit pr-1 name-typewriter-${len}`;
    case 'rainbow':
      return 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 animate-rainbow bg-[length:200%_auto]';
    case 'flicker':
      return 'text-white animate-flicker-neon';
    case 'bounce':
      return 'text-white animate-bounce-subtle inline-block';
    case 'shadow_3d':
      return 'text-white [text-shadow:2px_2px_0_#00f2ff,4px_4px_0_#0066aa]';
    case 'underline_glow':
      return 'text-white underline decoration-[#00f2ff] decoration-2 underline-offset-4 drop-shadow-[0_0_8px_#00f2ff]';
    case 'cyber':
      return 'text-cyan-300 animate-cyber tracking-widest uppercase';
    case 'blur_glitch':
      return 'text-white animate-blur-glitch inline-block relative';
    case 'shift':
      return 'text-white animate-shift inline-block';
    case 'sparks_blue':
    case 'sparks_yellow':
    case 'sparks_pink':
    case 'sparks_red':
    case 'sparks_white':
    case 'sparks_gold':
      return 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.75)] relative z-10';
    default:
      return 'text-white drop-shadow-md';
  }
}

export function getNameEffectStyle(effect: NameEffect | undefined, displayName: string): CSSProperties | undefined {
  const len = Math.max(displayName.length, 1);
  if (effect === 'typewriter') {
    return {
      animation: `typing 2.5s steps(${len}) forwards, blink 0.75s step-end infinite`,
      width: 0,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    };
  }
  return undefined;
}
