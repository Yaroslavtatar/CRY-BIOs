import React from 'react';
import { BioConfig, GlowTarget } from '../types';
import { resolveGlow, glowAppliesTo, glowVars, glowClass, glowInlineStyle } from '../glow';

interface GlowLayerProps {
  config: BioConfig;
  target: GlowTarget;
  children: React.ReactNode;
  className?: string;
}

/**
 * Подсветка элемента профиля. Работает для всех целей (аватар, ник, локация, бейджи, ссылки):
 * - avatar/username/location/badges: drop-shadow на обёртке повторяет форму содержимого (круг аватара, буквы, иконки);
 * - links: свечение получают только ссылки внутри блока, а сама обёртка без filter — иначе fixed-элементы
 *   внутри блоков (счётчик просмотров) «прилипли» бы к ней.
 */
export default function GlowLayer({ config, target, children, className = '' }: GlowLayerProps) {
  const g = resolveGlow(config);
  if (!glowAppliesTo(g, target)) return <div className={className}>{children}</div>;
  const kind = target === 'links' ? 'links' : 'fx';
  return (
    <div className={`${className} ${glowClass(g, kind)}`} style={glowVars(g)} data-glow-target={target}>
      {children}
    </div>
  );
}

/** Подсветка карточки профиля: box-shadow на самой карточке (классы и переменные). */
export function getCardGlow(config: BioConfig): { className: string; style: React.CSSProperties } {
  const g = resolveGlow(config);
  if (!glowAppliesTo(g, 'card')) return { className: '', style: {} };
  return { className: glowClass(g, 'box'), style: glowVars(g) };
}

/** Статичные стили элемента (кольцо аватара). Само свечение рисует GlowLayer. */
export function getGlowStyle(config: BioConfig, target: GlowTarget): React.CSSProperties {
  return glowInlineStyle(resolveGlow(config), target);
}

export function ProfileGradientWrapper({ config, children }: { config: BioConfig; children: React.ReactNode }) {
  if (!config.profileGradientEnabled || !config.profileGradientCss) {
    return <>{children}</>;
  }
  return (
    <div
      className="rounded-2xl p-[1px]"
      style={{ background: config.profileGradientCss }}
    >
      <div className="rounded-2xl bg-black/60 backdrop-blur-md">{children}</div>
    </div>
  );
}
