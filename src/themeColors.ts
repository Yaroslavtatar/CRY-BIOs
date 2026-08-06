import type { BioConfig } from './types';

export type ThemeColorKey =
  | 'verifiedBadge'
  | 'player'
  | 'location'
  | 'enterOverlay'
  | 'link'
  | 'sparkle'
  | 'primary'
  | 'glow'
  | 'text';

const DEFAULT_ACCENT = '#00f2ff';

export function resolveThemeColor(config: BioConfig | null | undefined, key: ThemeColorKey): string {
  if (!config) return DEFAULT_ACCENT;

  switch (key) {
    case 'verifiedBadge':
      return config.verifiedBadgeColor || config.primaryColor || DEFAULT_ACCENT;
    case 'player':
      return config.playerAccentColor || config.primaryColor || DEFAULT_ACCENT;
    case 'location':
      return config.locationColor || config.primaryColor || DEFAULT_ACCENT;
    case 'enterOverlay':
      return config.enterOverlayColor || config.primaryColor || DEFAULT_ACCENT;
    case 'link':
      return config.linkAccentColor || config.primaryColor || DEFAULT_ACCENT;
    case 'sparkle':
      return config.sparkleColor || config.primaryColor || DEFAULT_ACCENT;
    case 'primary':
      return config.primaryColor || DEFAULT_ACCENT;
    case 'glow':
      return config.glowColor || config.primaryColor || DEFAULT_ACCENT;
    case 'text':
      return config.textColor || '#ffffff';
    default:
      return config.primaryColor || DEFAULT_ACCENT;
  }
}

export const ELEMENT_COLOR_FIELDS = [
  'verifiedBadgeColor',
  'playerAccentColor',
  'locationColor',
  'enterOverlayColor',
  'linkAccentColor',
] as const;

export type ElementColorField = (typeof ELEMENT_COLOR_FIELDS)[number];
