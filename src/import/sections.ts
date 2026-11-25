import type { ImportSection } from './catalog';
import type { ImportedProfile } from './types';

export const hasValue = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

/** Поля раздела «Оформление». bgType и bgValue применяются только вместе. */
export const DESIGN_FIELDS = [
  'bgBlur', 'cardOpacity', 'snowEffectsEnabled', 'sparkles', 'sparkleStyle', 'nameEffect',
  'primaryColor', 'textColor', 'glowColor', 'monochromeMode', 'avatarGlowEnabled', 'linkHoverGlow',
  'profileGradientEnabled', 'profileGradientCss', 'swapBoxColors', 'glowEnabled', 'bgEffectColor',
  'verifiedBadgeColor', 'playerAccentColor', 'locationColor', 'enterOverlayColor', 'linkAccentColor',
  'sparkleColor', 'layoutMode', 'fontFamily', 'enterText', 'customCursorUrl',
] as const;

export const MUSIC_FIELDS = ['audioEnabled', 'audioPlayerMode', 'audioVisualizerEnabled', 'hidePlayerUntilHover'] as const;

export interface ImportSectionSummary {
  id: ImportSection;
  found: boolean;
  /** Коротко, что именно нашлось */
  detail: string;
}

const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export function hasDesign(p: ImportedProfile): boolean {
  return (hasValue(p.bgType) && hasValue(p.bgValue)) || DESIGN_FIELDS.some((k) => hasValue(p[k]));
}

export function describeImportedProfile(p: ImportedProfile, supported: readonly ImportSection[]): ImportSectionSummary[] {
  const all: ImportSectionSummary[] = [];

  const identity = [hasValue(p.displayName) && 'имя', hasValue(p.bio) && 'описание', hasValue(p.avatarUrl) && 'аватар', hasValue(p.locationText) && 'город']
    .filter(Boolean) as string[];
  all.push({ id: 'identity', found: identity.length > 0, detail: identity.join(', ') });

  const links = p.socialsList?.length ?? 0;
  all.push({ id: 'links', found: links > 0, detail: links ? `${links} ${plural(links, 'ссылка', 'ссылки', 'ссылок')}` : '' });

  const design = [
    hasValue(p.bgType) && hasValue(p.bgValue) && 'фон',
    (hasValue(p.primaryColor) || hasValue(p.textColor) || hasValue(p.glowColor)) && 'цвета',
    (hasValue(p.nameEffect) || p.sparkles === true || p.snowEffectsEnabled === true || p.glowEnabled === true) && 'эффекты',
    hasValue(p.fontFamily) && 'шрифт',
    (hasValue(p.layoutMode) || hasValue(p.cardOpacity)) && 'карточка',
  ].filter(Boolean) as string[];
  all.push({ id: 'design', found: hasDesign(p), detail: design.join(', ') });

  const tracks = p.playlist?.length ?? (hasValue(p.audioUrl) ? 1 : 0);
  all.push({ id: 'music', found: tracks > 0, detail: tracks ? `${tracks} ${plural(tracks, 'трек', 'трека', 'треков')}` : '' });

  const badges = p.badges?.filter((b) => b.type !== 'verified' && b.type !== 'staff').length ?? 0;
  all.push({ id: 'badges', found: badges > 0, detail: badges ? `${badges} ${plural(badges, 'бейдж', 'бейджа', 'бейджей')}` : '' });

  return all.filter((s) => supported.includes(s.id) || s.found);
}
