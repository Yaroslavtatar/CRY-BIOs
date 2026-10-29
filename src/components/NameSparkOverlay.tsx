import React, { useMemo } from 'react';
import type { NameEffect } from '../types';
import { getAuraFx, isSparkNameEffect, type NameEffectOptions } from '../utils/nameEffects';
import ParticleField from './ParticleField';

export { isSparkNameEffect };

const PAD_X = 46;
const PAD_Y = 30;

interface NameSparkOverlayProps {
  effect?: NameEffect;
  /** Сколько букв в имени: от этого зависит число частиц */
  textLength?: number;
  options?: NameEffectOptions;
  className?: string;
  /** Ограничение fps (мини-превью в меню) */
  fps?: number;
}

/**
 * Ауры вокруг ника (искры, звёзды, сердечки, огонь, снег).
 * Раньше слой стоял с z-index: -10 и прятался за фоном плитки/карточки; теперь он рисуется внутри собственного
 * контекста наложения (родителю нужен `isolate`), выступает за границы текста и не перехватывает клики.
 */
export default function NameSparkOverlay({ effect, textLength = 8, options, className = '', fps }: NameSparkOverlayProps) {
  const count = Math.max(14, Math.min(44, Math.round(textLength * 3.2)));
  const settings = useMemo(
    () => getAuraFx(effect, options, count),
    [effect, options?.color, options?.speed, count],
  );
  if (!settings) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 ${className}`} aria-hidden>
      <ParticleField
        settings={settings}
        fps={fps}
        boxInset={{ x: PAD_X, y: PAD_Y }}
        className="absolute"
        style={{ left: -PAD_X, right: -PAD_X, top: -PAD_Y, bottom: -PAD_Y, width: `calc(100% + ${PAD_X * 2}px)`, height: `calc(100% + ${PAD_Y * 2}px)` }}
      />
    </div>
  );
}
