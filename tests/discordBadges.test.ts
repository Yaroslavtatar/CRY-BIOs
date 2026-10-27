import { describe, it, expect } from 'vitest';
import {
  decodeDiscordBadges,
  discordAvatarUrl,
  mergeBadgesIntoLanyardUser,
  staticDiscordPresenceFromBio,
  describeActivity,
  normalizeDiscordStatus,
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

describe('бейджи разработчика', () => {
  it('Active Developer (1<<22) не превращается в Verified Developer', () => {
    expect(decodeDiscordBadges(1 << 22).map((b) => b.id)).toEqual(['active_dev']);
  });

  it('Verified Developer (1<<17) определяется отдельно', () => {
    expect(decodeDiscordBadges(1 << 17).map((b) => b.id)).toEqual(['verified_dev']);
    expect(decodeDiscordBadges((1 << 17) | (1 << 22)).map((b) => b.id)).toEqual(['verified_dev', 'active_dev']);
  });
});

describe('describeActivity', () => {
  it('null без активностей', () => {
    expect(describeActivity(undefined)).toBeNull();
    expect(describeActivity([])).toBeNull();
  });

  it('кастомный статус не выдаётся за игру', () => {
    expect(describeActivity([{ type: 4, name: 'Custom Status', state: 'coding', emoji: { name: '💻' } }])).toBe('💻 coding');
    expect(describeActivity([{ type: 4, name: 'Custom Status' }])).toBeNull();
  });

  it('игра приоритетнее музыки и кастомного статуса', () => {
    const acts = [
      { type: 4, state: 'afk' },
      { type: 2, name: 'Spotify', details: 'Song', state: 'Artist' },
      { type: 0, name: 'Minecraft' },
    ];
    expect(describeActivity(acts)).toBe('Playing Minecraft');
    expect(describeActivity(acts.slice(0, 2))).toBe('Listening to Song \u2014 Artist');
  });

  it('стрим', () => {
    expect(describeActivity([{ type: 1, name: 'Twitch', details: 'Speedrun' }])).toBe('Streaming Speedrun');
  });
});

describe('normalizeDiscordStatus', () => {
  it('неизвестные значения считает offline', () => {
    expect(normalizeDiscordStatus('dnd')).toBe('dnd');
    expect(normalizeDiscordStatus('invisible')).toBe('offline');
    expect(normalizeDiscordStatus(undefined)).toBe('offline');
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
    expect(res?.data.source).toBe('oauth');
  });
});
