/**
 * Соцсети проекта для главной страницы. Ссылки задаёт владелец инстанса через переменные окружения,
 * в коде ничего не зашито: пустые не показываются, невалидные отбрасываются.
 */

export type SocialId = 'telegram' | 'discord' | 'youtube' | 'x' | 'tiktok' | 'vk' | 'instagram' | 'twitch';

export interface SocialLink {
  id: SocialId;
  url: string;
}

interface SocialDef {
  id: SocialId;
  env: string;
  label: string;
  hosts: string[];
}

export const SOCIAL_DEFS: SocialDef[] = [
  { id: 'telegram', env: 'SOCIAL_TELEGRAM_URL', label: 'Telegram', hosts: ['t.me', 'telegram.me', 'telegram.dog'] },
  { id: 'discord', env: 'SOCIAL_DISCORD_URL', label: 'Discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com'] },
  { id: 'youtube', env: 'SOCIAL_YOUTUBE_URL', label: 'YouTube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be'] },
  { id: 'x', env: 'SOCIAL_X_URL', label: 'X', hosts: ['x.com', 'twitter.com', 'www.twitter.com'] },
  { id: 'tiktok', env: 'SOCIAL_TIKTOK_URL', label: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'] },
  { id: 'vk', env: 'SOCIAL_VK_URL', label: 'VK', hosts: ['vk.com', 'vk.ru', 'm.vk.com'] },
  { id: 'instagram', env: 'SOCIAL_INSTAGRAM_URL', label: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  { id: 'twitch', env: 'SOCIAL_TWITCH_URL', label: 'Twitch', hosts: ['twitch.tv', 'www.twitch.tv'] },
];

export const SOCIAL_LABELS: Record<SocialId, string> = Object.fromEntries(SOCIAL_DEFS.map((d) => [d.id, d.label])) as Record<SocialId, string>;

/** https-ссылка на домен именно этой соцсети; всё остальное (javascript:, чужие домены, мусор) отбрасывается */
export function validateSocialUrl(def: Pick<SocialDef, 'hosts'>, value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return def.hosts.includes(u.hostname.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function getSocialLinks(env: Record<string, string | undefined>, warn: (msg: string) => void = () => {}): SocialLink[] {
  const links: SocialLink[] = [];
  for (const def of SOCIAL_DEFS) {
    const raw = env[def.env];
    if (!raw || !raw.trim()) continue;
    const url = validateSocialUrl(def, raw);
    if (url) links.push({ id: def.id, url });
    else warn(`${def.env}: ссылка отклонена (нужна https-ссылка на ${def.hosts[0]})`);
  }
  return links;
}
