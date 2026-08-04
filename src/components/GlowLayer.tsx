import React from 'react';
import { BioConfig, GlowTarget } from '../types';

interface GlowLayerProps {
  config: BioConfig;
  target: GlowTarget;
  children: React.ReactNode;
  className?: string;
}

const INTENSITY_SPREAD: Record<string, string> = {
  low: '8px',
  medium: '16px',
  high: '28px',
};

export default function GlowLayer({ config, target, children, className = '' }: GlowLayerProps) {
  const glowOn = config.glowEnabled || config.avatarGlowEnabled || config.linkHoverGlow;
  const targets = config.glowTargets || ['avatar', 'username', 'badges', 'links'];
  const color = config.glowColor || config.primaryColor || '#00f2ff';
  const intensity = config.glowIntensity || 'medium';
  const spread = INTENSITY_SPREAD[intensity] || INTENSITY_SPREAD.medium;

  if (!glowOn || !targets.includes(target)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={className}
      style={{
        ['--glow-color' as string]: color,
        ['--glow-spread' as string]: spread,
      }}
      data-glow-target={target}
    >
      {children}
    </div>
  );
}

export function getGlowStyle(config: BioConfig, target: GlowTarget): React.CSSProperties {
  const glowOn = config.glowEnabled || config.avatarGlowEnabled;
  const targets = config.glowTargets || ['avatar', 'username', 'badges', 'links', 'card'];
  if (!glowOn || !targets.includes(target)) return {};

  const color = config.glowColor || config.primaryColor || '#00f2ff';
  const intensity = config.glowIntensity || 'medium';
  const spread = intensity === 'low' ? 8 : intensity === 'high' ? 28 : 16;

  if (target === 'avatar') {
    return { border: `2px solid ${color}`, boxShadow: `0 0 ${spread}px ${color}88` };
  }
  if (target === 'username') {
    return { textShadow: `0 0 ${spread}px ${color}, 0 0 ${spread * 2}px ${color}44` };
  }
  if (target === 'card') {
    return { boxShadow: `0 0 ${spread}px ${color}33, inset 0 0 ${spread / 2}px ${color}11` };
  }
  return {};
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
