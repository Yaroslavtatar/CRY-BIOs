import type { SocialLink } from '../types';

export type SocialPlatformId = SocialLink['platform'];

export interface SocialPlatformMeta {
  id: SocialPlatformId;
  label: string;
  brandColor: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  { id: 'discord', label: 'Discord', brandColor: '#5865F2' },
  { id: 'github', label: 'GitHub', brandColor: '#FFFFFF' },
  { id: 'telegram', label: 'Telegram', brandColor: '#26A5E4' },
  { id: 'youtube', label: 'YouTube', brandColor: '#FF0000' },
  { id: 'steam', label: 'Steam', brandColor: '#66C0F4' },
  { id: 'spotify', label: 'Spotify', brandColor: '#1DB954' },
  { id: 'twitter', label: 'X / Twitter', brandColor: '#1DA1F2' },
  { id: 'instagram', label: 'Instagram', brandColor: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', brandColor: '#FE2C55' },
  { id: 'twitch', label: 'Twitch', brandColor: '#9146FF' },
  { id: 'vk', label: 'ВКонтакте', brandColor: '#0077FF' },
  { id: 'reddit', label: 'Reddit', brandColor: '#FF4500' },
  { id: 'snapchat', label: 'Snapchat', brandColor: '#FFFC00' },
  { id: 'facebook', label: 'Facebook', brandColor: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', brandColor: '#0A66C2' },
  { id: 'whatsapp', label: 'WhatsApp', brandColor: '#25D366' },
  { id: 'email', label: 'Email', brandColor: '#EA4335' },
  { id: 'soundcloud', label: 'SoundCloud', brandColor: '#FF5500' },
  { id: 'patreon', label: 'Patreon', brandColor: '#FF424D' },
  { id: 'kick', label: 'Kick', brandColor: '#53FC18' },
  { id: 'threads', label: 'Threads', brandColor: '#FFFFFF' },
  { id: 'roblox', label: 'Roblox', brandColor: '#E2231A' },
  { id: 'paypal', label: 'PayPal', brandColor: '#00457C' },
  { id: 'website', label: 'Сайт', brandColor: '#00f2ff' },
];

export function getPlatformBrandColor(platform: string): string {
  return SOCIAL_PLATFORMS.find(p => p.id === platform)?.brandColor || '#ffffff';
}

export function getSocialIconColor(link: SocialLink, fallback = '#ffffff'): string {
  if (link.useBrandColor !== false) return getPlatformBrandColor(link.platform);
  return link.iconColor || fallback;
}
