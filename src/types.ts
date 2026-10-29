/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SongConfig {
  id: string;
  url: string;
  title: string;
  artist: string;
}

export interface SocialLink {
  id: string;
  platform:
    | 'discord' | 'github' | 'telegram' | 'youtube' | 'steam' | 'spotify'
    | 'twitter' | 'x' | 'instagram' | 'tiktok' | 'website'
    | 'twitch' | 'vk' | 'reddit' | 'snapchat' | 'facebook' | 'linkedin'
    | 'whatsapp' | 'email' | 'soundcloud' | 'patreon' | 'kick' | 'threads'
    | 'roblox' | 'paypal' | 'cashapp' | 'venmo' | 'playstation' | 'xbox'
    | 'applemusic' | 'gitlab' | 'bluesky' | 'onlyfans' | 'pinterest' | 'lastfm'
    | 'buymeacoffee' | 'kofi' | 'signal' | 'bitcoin' | 'ethereum' | 'litecoin'
    | 'solana' | 'monero' | 'xrp';
  url: string;
  label?: string;
  glow?: boolean;
  useBrandColor?: boolean;
  iconColor?: string;
}

export type BackgroundType = 'color' | 'gradient' | 'image' | 'video' | 'matrix' | 'stars' | 'rain' | 'particles' | 'snow' | 'aurora' | 'plasma' | 'dither';
export type LayoutMode = 'default' | 'compact' | 'sleek';
export type GlowIntensity = 'low' | 'medium' | 'high';
export type GlowStyleId = 'soft' | 'pulse' | 'breathe' | 'flicker' | 'rainbow' | 'dual';
export type CardStyle = 'none' | 'glass' | 'solid' | 'outline';
export type GlowTarget = 'avatar' | 'username' | 'location' | 'badges' | 'links' | 'card';
export type VerifiedBadgeStyle = 'inline' | 'chip' | 'ring' | 'none';
export type BadgeStyle = 'icon' | 'pill' | 'text' | 'image';
export type BadgeSize = 'sm' | 'md' | 'lg';

export type AudioPlayerMode = 'hidden' | 'minimal' | 'inline' | 'floating' | 'free';
/** full — как раньше; compact — без прогресс-бара; button — только круглая кнопка (звук вкл/выкл) + громкость */
export type AudioPlayerStyle = 'full' | 'compact' | 'button';
/** Позиция свободного плеера, % свободного места внутри экрана (0 — у левого/верхнего края, 100 — у правого/нижнего) */
export interface AudioPlayerPos {
  x: number;
  y: number;
}
export type AudioSourceMode = 'single' | 'playlist';
export type AudioVisualizerStyle = 'bars' | 'wave' | 'retro' | 'circular' | 'mirror' | 'oscilloscope' | 'particles' | 'aurora' | 'pulse';
export type NameEffect =
  | 'none' | 'glow' | 'stroke' | 'gradient' | 'glitch' | 'neon' | 'shine'
  | 'neon_red' | 'neon_blue' | 'gradient_fire' | 'gradient_ocean' | 'typewriter'
  | 'rainbow' | 'flicker' | 'bounce' | 'shadow_3d' | 'underline_glow' | 'cyber'
  | 'shuffle' | 'fuzzy' | 'blur_glitch' | 'shift'
  | 'sparks_blue' | 'sparks_yellow' | 'sparks_pink' | 'sparks_red' | 'sparks_white' | 'sparks_gold'
  // v2: неон
  | 'neon_pink' | 'neon_green' | 'neon_purple' | 'neon_gold' | 'outline_neon'
  // v2: градиенты и металл
  | 'sunset' | 'candy' | 'aurora_text' | 'holo' | 'chrome' | 'gold' | 'ice' | 'synthwave' | 'fire_text'
  // v2: анимации
  | 'rgb_split' | 'scan' | 'ghost' | 'electric' | 'toxic' | 'matrix_text'
  // v2: по буквам
  | 'wave' | 'cascade' | 'jelly' | 'flip3d'
  // v2: искры и ауры
  | 'sparks_cyan' | 'sparks_green' | 'sparks_purple' | 'sparks_rainbow'
  | 'stars_aura' | 'hearts_aura' | 'fire_aura' | 'snow_aura';
import type { FxType, FxMouseMode, FxColorMode } from './fx/engine';
export type { FxType, FxMouseMode, FxColorMode };
export type SparkleStyle = 'stars' | 'dots' | 'hearts' | 'crosses' | 'neon' | 'snow' | 'petals' | 'notes' | 'bubbles';
export type LocationIcon = 'pin' | 'globe' | 'map';
export type LocationStyle = 'minimal' | 'pill' | 'glow' | 'geo_pulse';

export interface BlockConfig {
  id: string;
  type: 'socials' | 'html' | 'status_api' | 'views_counter' | 'textbox' | 'quote' | 'image' | 'embed';
  title: string;
  enabled: boolean;

  socialsList?: SocialLink[];
  htmlContent?: string;
  statusProvider?: 'discord' | 'custom';
  statusCustomText?: string;
  statusUrl?: string;
  textboxContent?: string;
  textboxStyle?: 'glow' | 'marquee' | 'standard';
  quoteText?: string;
  quoteAuthor?: string;

  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageHeight?: number;
  imageFit?: 'cover' | 'contain' | 'fill';

  embedType?: 'youtube' | 'spotify' | 'soundcloud' | 'custom_iframe';
  embedUrl?: string;

  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
  glow?: boolean;
  glowColor?: string;
}

export interface UserBadge {
  id: string;
  type: 'verified' | 'premium' | 'developer' | 'vip' | 'staff' | 'booster' | 'member' | 'custom';
  icon: string;
  label: string;
  description?: string;
  enabled: boolean;
  glow?: boolean;
  glowColor?: string;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  badgeStyle?: BadgeStyle;
  imageUrl?: string;
  showLabel?: boolean;
  size?: BadgeSize;
}

export interface BioConfig {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  customBadge: string;
  sparkles: boolean;
  badges?: UserBadge[];

  discordConnected?: boolean;
  discordUsername?: string;
  discordDisplayName?: string;
  discordAvatarHash?: string | null;
  discordPremiumType?: number;
  discordPublicFlags?: number;
  discordLinkedAt?: string;
  googleConnected?: boolean;
  googleEmail?: string;
  aliasSlug?: string;
  uid?: number;

  fontFamily: 'Inter' | 'Space Grotesk' | 'JetBrains Mono' | 'Outfit' | 'Playfair Display';
  primaryColor: string;
  textColor: string;
  glowColor: string;
  verifiedBadgeColor?: string;
  playerAccentColor?: string;
  locationColor?: string;
  enterOverlayColor?: string;
  linkAccentColor?: string;
  customCSS?: string;
  cardOpacity?: number;
  badgeOpacity?: number;

  bgType: BackgroundType;
  bgValue: string;
  bgBlur: number;
  bgDim: number;
  bgEffectColor?: string;
  bgEffectIntensity?: number;

  audioUrl: string;
  audioTitle: string;
  audioArtist: string;
  audioEnabled: boolean;
  audioPlayerMode?: AudioPlayerMode;
  audioPlayerStyle?: AudioPlayerStyle;
  audioPlayerPos?: AudioPlayerPos;
  audioPlayerOpacity?: number;
  audioShowTrackInfo?: boolean;
  audioShowProgress?: boolean;
  audioShowSkip?: boolean;
  audioSourceMode?: AudioSourceMode;
  audioVisualizerEnabled?: boolean;
  audioVisualizerStyle?: AudioVisualizerStyle;
  playlist?: SongConfig[];
  hidePlayerUntilHover?: boolean;
  rememberVolume?: boolean;
  volumeControlVisible?: boolean;

  layoutMode?: LayoutMode;
  mobileOptimized?: boolean;
  verifiedBadgeStyle?: VerifiedBadgeStyle;
  glowEnabled?: boolean;
  glowIntensity?: GlowIntensity;
  /** Подсветка v2 */
  glowStyle?: GlowStyleId;
  glowColor2?: string;
  /** Радиус свечения, px (4–44). Без него берётся из glowIntensity */
  glowSize?: number;
  glowSpeed?: number;

  /** Карточка профиля (как на guns.lol): по умолчанию выключена */
  cardStyle?: CardStyle;
  /** Непрозрачность поверхности карточки профиля, 0.1–0.95 (не путать с cardOpacity — это прозрачность блоков, 0–100) */
  cardSurfaceOpacity?: number;
  /** Размытие фона за карточкой, px (0–40) */
  cardBlur?: number;
  /** Скругление, px (0–48) */
  cardRadius?: number;
  cardBorder?: boolean;
  /** Наклон карточки за курсором */
  cardTilt?: boolean;
  /** Угол наклона, градусы (2–20) */
  cardTiltStrength?: number;
  /** Световой блик, который следует за курсором */
  cardGlare?: boolean;
  /** Карточка слегка приподнимается при наведении */
  cardLift?: boolean;
  glowTargets?: GlowTarget[];
  profileGradientEnabled?: boolean;
  profileGradientCss?: string;
  swapBoxColors?: boolean;
  monochromeIcons?: boolean;
  memberSince?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;

  bgVideoAudioEnabled?: boolean;
  bgVideoUseAsAudio?: boolean;

  locationEnabled?: boolean;
  locationText?: string;
  locationIcon?: LocationIcon;
  locationStyle?: LocationStyle;

  sparkleStyle?: SparkleStyle;
  sparkleColor?: string;
  sparkleIntensity?: 'low' | 'medium' | 'high';

  /** Устаревшее: снегопад. Читается как fxType: 'snow', если fxEnabled не задан */
  snowEffectsEnabled?: boolean;
  snowIntensity?: 'low' | 'medium' | 'high';

  /** Частицы поверх фона (снег, дождь, листья, лепестки…) */
  fxEnabled?: boolean;
  fxType?: FxType;
  fxColorMode?: FxColorMode;
  fxColor?: string;
  fxDensity?: number;
  fxSize?: number;
  fxSpeed?: number;
  /** −1 (влево) … 1 (вправо) */
  fxWind?: number;
  fxSway?: number;
  fxMouse?: FxMouseMode;
  fxReverse?: boolean;
  /** Рисовать частицы поверх контента, а не под ним */
  fxFront?: boolean;

  /** Настройка эффекта ника: свои цвета и скорость (если эффект это поддерживает) */
  nameEffectColor?: string;
  nameEffectColor2?: string;
  nameEffectSpeed?: number;

  showViewsCounter?: boolean;
  showUid?: boolean;
  monochromeMode?: boolean;
  parallaxEnabled?: boolean;
  avatarGlowEnabled?: boolean;
  linkHoverGlow?: boolean;
  customPageTitle?: string;
  customFaviconUrl?: string;

  customDomain?: string;
  enterText: string;
  clickToEnterEnabled?: boolean;
  customCursorUrl?: string;
  nameEffect?: NameEffect;
  discordId?: string;
  layout?: string[];

  blocks: BlockConfig[];
}

export interface VisitRecord {
  timestamp: string;
  referrer: string;
  device: string;
  browser: string;
  country: string;
  host?: string;
}

export interface AnalyticsSummary {
  username: string;
  totalViews: number;
  uniqueViews: number;
  visitsOverTime: { date: string; views: number }[];
  referrersHistogram: { referrer: string; count: number }[];
  devicesHistogram: { device: string; count: number }[];
  browsersHistogram: { browser: string; count: number }[];
  countriesHistogram: { country: string; count: number }[];
  hostsHistogram?: { host: string; count: number }[];
}
