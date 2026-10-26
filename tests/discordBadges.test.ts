import { describe, it, expect } from 'vitest';
import {
  decodeDiscordBadges,
  discordAvatarUrl,
  mergeBadgesIntoLanyardUser,
  staticDiscordPresenceFromBio,
} from '../src/discordBadges';

describe('decodeDiscordBadges', () => {
  it('возвращает пустой список без флагов', () => {
    expect(decodeDiscordBadges()).toEqual([]);
  });

  it('определяет Nitro по premiumType', () => {
    expect(decodeDiscordBadges(0, 2).map((b) => b.id)).toEqual(['nitro']);
    expect(decodeDiscordBadges(0, 1).map((b) => b.id)).toEqual(['nitro_classic']);
    expect(decodeDiscordBadges(0, 3).map((b) => b.id)).toEqual(['nitro_basic']);
  });

  it('раскладывает публичные флаги', () => {
    const ids = decodeDiscordBadges((1 << 0) | (1 << 1)).map((b) => b.id);
    expect(ids).toEqual(['staff', 'partner']);
  });
});

describe('discordAvatarUrl', () => {
  it('использует png для обычного хеша и gif для анимированного', () => {
    expect(discordAvatarUrl('123', 'abc', 64)).toBe('https://cdn.discordapp.com/avatars/123/abc.png?size=64');
    expect(discordAvatarUrl('123', 'a_abc', 64)).toBe('https://cdn.discordapp.com/avatars/123/a_abc.gif?size=64');
  });

  it('без хеша отдаёт дефолтный аватар', () => {
    expect(discordAvatarUrl('100000000000000007')).toMatch(/embed\/avatars\/\d\.png$/);
  });
});

describe('mergeBadgesIntoLanyardUser', () => {
  it('не трогает данные без discord_user', () => {
    const data = { activities: [] };
    expect(mergeBadgesIntoLanyardUser(data, 1, 2)).toBe(data);
  });

  it('добавляет badges в discord_user', () => {
    const merged = mergeBadgesIntoLanyardUser({ discord_user: { id: '1' } }, 0, 2);
    expect(merged.discord_user.badges.map((b: any) => b.id)).toEqual(['nitro']);
    expect(merged.discord_user.id).toBe('1');
  });
});

describe('staticDiscordPresenceFromBio', () => {
  it('возвращает null без discordId', () => {
    expect(staticDiscordPresenceFromBio({})).toBeNull();
  });

  it('собирает offline-presence из данных OAuth', () => {
    const res = staticDiscordPresenceFromBio({ discordId: '42', discordUsername: 'bro' });
    expect(res?.success).toBe(true);
    expect(res?.data.discord_status).toBe('offline');
    expect(res?.data.discord_user.username).toBe('bro');
  });
});
