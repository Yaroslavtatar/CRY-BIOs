import type { SocialLink } from '../types';

export type SocialPlatformId = SocialLink['platform'];

export interface SocialPlatformMeta {
  id: SocialPlatformId;
  label: string;
  brandColor: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  { id: 'discord', label: 'Discord', brandColor: '#5865F2' },
  { id: 'github', label: 'GitHub', brandColor: '#181717' },
  { id: 'telegram', label: 'Telegram', brandColor: '#26A5E4' },
  { id: 'youtube', label: 'YouTube', brandColor: '#FF0000' },
  { id: 'steam', label: 'Steam', brandColor: '#000000' },
  { id: 'spotify', label: 'Spotify', brandColor: '#1DB954' },
  { id: 'twitter', label: 'X / Twitter', brandColor: '#000000' },
  { id: 'x', label: 'X', brandColor: '#000000' },
  { id: 'instagram', label: 'Instagram', brandColor: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', brandColor: '#000000' },
  { id: 'twitch', label: 'Twitch', brandColor: '#9146FF' },
  { id: 'vk', label: 'ВКонтакте', brandColor: '#0077FF' },
  { id: 'reddit', label: 'Reddit', brandColor: '#FF4500' },
  { id: 'snapchat', label: 'Snapchat', brandColor: '#FFFC00' },
  { id: 'facebook', label: 'Facebook', brandColor: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', brandColor: '#0A66C2' },
  { id: 'whatsapp', label: 'WhatsApp', brandColor: '#25D366' },
  { id: 'email', label: 'Email', brandColor: '#EA4335' },
  { id: 'soundcloud', label: 'SoundCloud', brandColor: '#FF5500' },
  { id: 'patreon', label: 'Patreon', brandColor: '#000000' },
  { id: 'kick', label: 'Kick', brandColor: '#53FC18' },
  { id: 'threads', label: 'Threads', brandColor: '#000000' },
  { id: 'roblox', label: 'Roblox', brandColor: '#000000' },
  { id: 'paypal', label: 'PayPal', brandColor: '#003087' },
  { id: 'cashapp', label: 'Cash App', brandColor: '#00C244' },
  { id: 'venmo', label: 'Venmo', brandColor: '#008CFF' },
  { id: 'playstation', label: 'PlayStation', brandColor: '#0070D1' },
  { id: 'xbox', label: 'Xbox', brandColor: '#107C10' },
  { id: 'applemusic', label: 'Apple Music', brandColor: '#FA243C' },
  { id: 'gitlab', label: 'GitLab', brandColor: '#FC6D26' },
  { id: 'bluesky', label: 'Bluesky', brandColor: '#1185FE' },
  { id: 'onlyfans', label: 'OnlyFans', brandColor: '#00AFF0' },
  { id: 'pinterest', label: 'Pinterest', brandColor: '#BD081C' },
  { id: 'lastfm', label: 'Last.fm', brandColor: '#D51007' },
  { id: 'buymeacoffee', label: 'Buy Me a Coffee', brandColor: '#FFDD00' },
  { id: 'kofi', label: 'Ko-fi', brandColor: '#FF5E5B' },
  { id: 'signal', label: 'Signal', brandColor: '#3A76F0' },
  { id: 'bitcoin', label: 'Bitcoin', brandColor: '#F7931A' },
  { id: 'ethereum', label: 'Ethereum', brandColor: '#3C3C3D' },
  { id: 'litecoin', label: 'Litecoin', brandColor: '#A6A9AA' },
  { id: 'solana', label: 'Solana', brandColor: '#9945FF' },
  { id: 'monero', label: 'Monero', brandColor: '#FF6600' },
  { id: 'xrp', label: 'XRP', brandColor: '#25A768' },
  { id: 'website', label: 'Сайт / Custom URL', brandColor: '#00f2ff' },
];

export function getPlatformBrandColor(platform: string): string {
  return SOCIAL_PLATFORMS.find(p => p.id === platform)?.brandColor || '#ffffff';
}

export function getSocialIconColor(link: SocialLink, fallback = '#ffffff'): string {
  if (link.useBrandColor !== false) return getPlatformBrandColor(link.platform);
  return link.iconColor || fallback;
}
