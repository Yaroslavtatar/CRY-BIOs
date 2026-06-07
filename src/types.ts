/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SocialLink {
  id: string;
  platform: 'discord' | 'github' | 'telegram' | 'youtube' | 'steam' | 'spotify' | 'twitter' | 'instagram' | 'tiktok' | 'website';
  url: string;
  label?: string;
  glow?: boolean;
}

export type BackgroundType = 'color' | 'gradient' | 'image' | 'video' | 'matrix' | 'stars' | 'rain' | 'particles';

export interface BlockConfig {
  id: string;
  type: 'socials' | 'html' | 'status_api' | 'views_counter' | 'textbox' | 'quote' | 'image' | 'embed';
  title: string;
  enabled: boolean;
  
  // Specific configurations depending on type
  socialsList?: SocialLink[];
  htmlContent?: string;
  statusProvider?: 'discord' | 'custom';
  statusCustomText?: string;
  statusUrl?: string; // e.g., lanyard discord ID
  textboxContent?: string;
  textboxStyle?: 'glow' | 'marquee' | 'standard';
  quoteText?: string;
  quoteAuthor?: string;

  // Image block configurations
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageHeight?: number; // in px
  imageFit?: 'cover' | 'contain' | 'fill';

  // Embed block configurations
  embedType?: 'youtube' | 'spotify' | 'soundcloud' | 'custom_iframe';
  embedUrl?: string;

  // Custom block-level styling overrides
  bgColor?: string; // hex or rgba or transparent
  textColor?: string; // hex
  borderColor?: string; // hex
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
  glow?: boolean;
  glowColor?: string; // hex
}

export interface UserBadge {
  id: string;
  type: 'verified' | 'premium' | 'developer' | 'vip' | 'staff' | 'booster' | 'member' | 'custom';
  icon: string; // crown, shield, shieldCheck, gem, award, star, heart, zap, code, flame, skull, gamepad
  label: string;
  description?: string;
  enabled: boolean;
  glow?: boolean;
  glowColor?: string;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
}

export interface BioConfig {
  username: string; // url slug
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  customBadge: string;
  sparkles: boolean;
  badges?: UserBadge[]; // List of custom transparent badges with ordering

  
  // Custom interactive connections and stats
  discordConnected?: boolean;
  discordUsername?: string;
  googleConnected?: boolean;
  googleEmail?: string;
  aliasSlug?: string;
  uid?: number;
  
  // Font & Styling
  fontFamily: 'Inter' | 'Space Grotesk' | 'JetBrains Mono' | 'Outfit' | 'Playfair Display';
  primaryColor: string; // hex
  textColor: string; // hex
  glowColor: string; // hex
  customCSS?: string;
  cardOpacity?: number; // 0 to 100
  badgeOpacity?: number; // 0 to 100
  
  // Background
  bgType: BackgroundType;
  bgValue: string; // hex color, gradient string, URL for image/video
  bgBlur: number; // 0 to 20
  bgDim: number; // 0 to 100 for dim factor overlay %
  
  // Audio
  audioUrl: string;
  audioTitle: string;
  audioArtist: string;
  audioEnabled: boolean;
  enterText: string; // Click-to-enter splash screen text, e.g. "enter"
  clickToEnterEnabled?: boolean;
  customCursorUrl?: string;
  snowEffectsEnabled?: boolean;
  nameEffect?: 'none' | 'glow' | 'stroke' | 'gradient' | 'glitch' | 'neon' | 'shine' | 'neon_red' | 'neon_blue' | 'gradient_fire' | 'gradient_ocean' | 'typewriter';
  discordId?: string;
  layout?: string[];
  
  // Blocks
  blocks: BlockConfig[];
}

export interface VisitRecord {
  timestamp: string;
  referrer: string;
  device: string;
  browser: string;
  country: string;
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
}
