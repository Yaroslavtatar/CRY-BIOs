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
    | 'twitter' | 'instagram' | 'tiktok' | 'website'
    | 'twitch' | 'vk' | 'reddit' | 'snapchat' | 'facebook' | 'linkedin'
    | 'whatsapp' | 'email' | 'soundcloud' | 'patreon' | 'kick' | 'threads'
    | 'roblox' | 'paypal';
  url: string;
  label?: string;
  glow?: boolean;
  useBrandColor?: boolean;
  iconColor?: string;
}

export type BackgroundType = 'color' | 'gradient' | 'image' | 'video' | 'matrix' | 'stars' | 'rain' | 'particles' | 'snow' | 'aurora' | 'plasma' | 'dither';
export type LayoutMode = 'default' | 'compact' | 'sleek';
export type GlowIntensity = 'low' | 'medium' | 'high';
export type GlowTarget = 'avatar' | 'username' | 'location' | 'badges' | 'links' | 'card';
export type VerifiedBadgeStyle = 'inline' | 'chip' | 'ring' | 'none';
export type BadgeStyle = 'icon' | 'pill' | 'text' | 'image';
export type BadgeSize = 'sm' | 'md' | 'lg';

export type AudioPlayerMode = 'hidden' | 'minimal' | 'inline' | 'floating';
export type AudioSourceMode = 'single' | 'playlist';
export type AudioVisualizerStyle = 'bars' | 'wave' | 'retro' | 'circular' | 'mirror' | 'oscilloscope' | 'particles' | 'aurora' | 'pulse';
export type NameEffect =
  | 'none' | 'glow' | 'stroke' | 'gradient' | 'glitch' | 'neon' | 'shine'
  | 'neon_red' | 'neon_blue' | 'gradient_fire' | 'gradient_ocean' | 'typewriter'
  | 'rainbow' | 'flicker' | 'bounce' | 'shadow_3d' | 'underline_glow' | 'cyber'
  | 'shuffle' | 'fuzzy';
export type SparkleStyle = 'stars' | 'dots' | 'hearts' | 'crosses' | 'neon';
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

  snowEffectsEnabled?: boolean;
  snowIntensity?: 'low' | 'medium' | 'high';

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
