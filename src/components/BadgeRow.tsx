import React from 'react';
import { UserBadge } from '../types';
import { Crown, Shield, ShieldCheck, Gem, Award, Star, Heart, Zap, Code2, Skull, Gamepad2, Coffee, Terminal, Sparkles, Music, Flame } from 'lucide-react';

const renderBadgeIcon = (iconName: string, size: string) => {
  const iconProps = { className: `${size} flex-shrink-0` };
  switch (iconName?.toLowerCase()) {
    case 'crown': return <Crown {...iconProps} />;
    case 'shield': return <Shield {...iconProps} />;
    case 'shieldcheck': return <ShieldCheck {...iconProps} />;
    case 'gem': return <Gem {...iconProps} />;
    case 'award': return <Award {...iconProps} />;
    case 'star': return <Star {...iconProps} />;
    case 'heart': return <Heart {...iconProps} />;
    case 'zap': return <Zap {...iconProps} />;
    case 'code': return <Code2 {...iconProps} />;
    case 'flame': return <Flame {...iconProps} />;
    case 'skull': return <Skull {...iconProps} />;
    case 'gamepad': return <Gamepad2 {...iconProps} />;
    case 'music': return <Music {...iconProps} />;
    case 'terminal': return <Terminal {...iconProps} />;
    case 'coffee': return <Coffee {...iconProps} />;
    default: return <Sparkles {...iconProps} />;
  }
};

interface BadgeRowProps {
  badges: UserBadge[];
  badgeOpacity?: number;
  inline?: boolean;
  primaryColor?: string;
}

export default function BadgeRow({ badges, inline = false, primaryColor = '#00f2ff' }: BadgeRowProps) {
  const enabled = badges.filter(b => b.enabled);
  if (enabled.length === 0) return null;

  const containerClass = inline
    ? 'flex items-center gap-1.5 flex-wrap justify-center'
    : 'flex flex-wrap items-center justify-center gap-2 max-sm:overflow-x-auto max-sm:flex-nowrap max-sm:justify-start max-sm:w-full max-sm:px-1 max-sm:pb-1';

  return (
    <div className={containerClass}>
      {enabled.map(badge => {
        const style = badge.badgeStyle || 'icon';
        const size = badge.size || 'md';
        const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
        const textColor = badge.textColor || 'white';
        const glowColor = badge.glowColor || primaryColor;
        const glowStyle = badge.glow
          ? { boxShadow: `0 0 14px ${glowColor}88`, borderColor: `${glowColor}66` }
          : {};

        if (style === 'image' && badge.imageUrl) {
          return (
            <img
              key={badge.id}
              src={badge.imageUrl}
              alt={badge.label}
              title={badge.description || badge.label}
              className={`${size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8' : 'h-6'} object-contain cursor-help`}
              loading="lazy"
            />
          );
        }

        if (style === 'pill' || style === 'text' || badge.showLabel) {
          return (
            <div
              key={badge.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wide cursor-help transition-colors ${
                style === 'text' ? 'bg-transparent border-transparent' : 'bg-black/80 border-white/20'
              }`}
              title={badge.description || badge.label}
              style={{
                color: textColor,
                backgroundColor: badge.bgColor || undefined,
                borderColor: badge.borderColor || undefined,
                ...glowStyle,
              }}
            >
              {style !== 'text' && renderBadgeIcon(badge.icon, iconSize)}
              <span>{badge.label}</span>
            </div>
          );
        }

        return (
          <div
            key={badge.id}
            className="flex items-center justify-center p-1.5 rounded-sm bg-black/80 border border-white/20 hover:border-white/40 transition-colors shadow-sm cursor-help"
            title={badge.description || badge.label}
            style={{
              color: textColor,
              backgroundColor: badge.bgColor || undefined,
              borderColor: badge.borderColor || 'rgba(255,255,255,0.1)',
              ...glowStyle,
            }}
          >
            {renderBadgeIcon(badge.icon, iconSize)}
          </div>
        );
      })}
    </div>
  );
}
