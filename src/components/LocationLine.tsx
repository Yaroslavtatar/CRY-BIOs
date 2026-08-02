import React from 'react';
import { MapPin, Globe, Map } from 'lucide-react';
import { BioConfig } from '../types';

interface LocationLineProps {
  config: BioConfig;
}

export default function LocationLine({ config }: LocationLineProps) {
  if (!config.locationEnabled || !config.locationText?.trim()) return null;

  const icon = config.locationIcon || 'pin';
  const style = config.locationStyle || 'pill';
  const color = config.primaryColor || '#00f2ff';

  const Icon = icon === 'globe' ? Globe : icon === 'map' ? Map : MapPin;

  const base = 'flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase mb-3';

  if (style === 'minimal') {
    return (
      <div className={`${base} text-neutral-400`}>
        <Icon className="w-3 h-3" style={{ color }} />
        <span>{config.locationText}</span>
      </div>
    );
  }

  if (style === 'glow') {
    return (
      <div
        className={`${base} text-white`}
        style={{ textShadow: `0 0 12px ${color}, 0 0 24px ${color}44` }}
      >
        <Icon className="w-3 h-3" style={{ color }} />
        <span>{config.locationText}</span>
      </div>
    );
  }

  return (
    <div
      className={`${base} text-neutral-300 px-3 py-1 rounded-full border backdrop-blur-sm`}
      style={{ borderColor: `${color}44`, backgroundColor: `${color}11` }}
    >
      <Icon className="w-3 h-3" style={{ color }} />
      <span>{config.locationText}</span>
    </div>
  );
}
