import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BioConfig, VerifiedBadgeStyle } from '../types';
import { resolveThemeColor } from '../themeColors';

interface VerifiedBadgeProps {
  config: BioConfig;
  style?: VerifiedBadgeStyle;
  className?: string;
}

export default function VerifiedBadge({ config, style, className = '' }: VerifiedBadgeProps) {
  if (!config.verified) return null;

  const variant = style || config.verifiedBadgeStyle || 'inline';
  if (variant === 'none') return null;

  const color = resolveThemeColor(config, 'verifiedBadge');

  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border ml-2 ${className}`}
        style={{
          color,
          borderColor: `${color}66`,
          backgroundColor: `${color}15`,
          boxShadow: `0 0 12px ${color}44`,
        }}
        title="Verified"
      >
        <CheckCircle2 className="w-3 h-3" />
        Verified
      </span>
    );
  }

  if (variant === 'ring') {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center ml-2 ${className}`}
      title="Verified"
      aria-label="Verified account"
    >
      <CheckCircle2 className="w-[18px] h-[18px]" style={{ color, filter: `drop-shadow(0 0 6px ${color}88)` }} />
    </span>
  );
}

export function VerifiedAvatarRing({ config, children }: { config: BioConfig; children: React.ReactNode }) {
  if (!config.verified || (config.verifiedBadgeStyle || 'inline') !== 'ring') {
    return <>{children}</>;
  }
  const color = resolveThemeColor(config, 'verifiedBadge');
  return (
    <div
      className="rounded-full p-[3px]"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}44)`,
        boxShadow: `0 0 20px ${color}66`,
      }}
    >
      {children}
    </div>
  );
}
