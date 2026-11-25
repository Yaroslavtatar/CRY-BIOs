import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createReferralStore, normalizeRefCode, ReferralError } from '../src/referrals';
import { createTelegramAuthStore, normalizeKey, formatKey, KEY_TTL_MS, suggestUsername } from '../src/telegramAuth';
import { createBotHandler } from '../src/telegramBot';

describe('referrals', () => {
  let refs: ReturnType<typeof createReferralStore>;
  beforeEach(() => {
    refs = createReferralStore(new Database(':memory:'));
  });

  it('создаёт ссылку со случайным или своим кодом', () => {
    const a = refs.createLink({ name: 'Вася' });
    expect(a.code).toMatch(/^[a-z0-9]{8}$/);
    const b = refs.createLink({ name: 'Петя', code: 'Petya-Ads' });
    expect(b.code).toBe('petya-ads');
    expect(() => refs.createLink({ name: 'Дубль', code: 'petya-ads' })).toThrow(ReferralError);
    expect(() => refs.createLink({ name: '' })).toThrow(ReferralError);
    expect(() => refs.createLink({ name: 'x', code: 'a b' })).toThrow(ReferralError);
  });

  it('нормализует код', () => {
    expect(normalizeRefCode(' ABC-12 ')).toBe('abc-12');
    expect(normalizeRefCode('ab')).toBe('');
    expect(normalizeRefCode('a'.repeat(33))).toBe('');
    expect(normalizeRefCode(undefined)).toBe('');
  });

  it('считает переходы и регистрации, один пользователь — одна атрибуция', () => {
    const l = refs.createLink({ name: 'Ads', code: 'ads1' });
    expect(refs.recordClick('ads1')).toBe(true);
    expect(refs.recordClick('nope')).toBe(false);
    expect(refs.recordSignup('alice', 'ads1', 'web')).toBe(true);
    expect(refs.recordSignup('alice', 'ads1', 'telegram')).toBe(false);
    expect(refs.recordSignup('bob', 'ads1', 'telegram')).toBe(true);
    const [s] = refs.listLinksWithStats();
    expect(s.code).toBe(l.code);
    expect(s.clicks).toBe(1);
    expect(s.signups).toBe(2);
    expect(s.telegramSignups).toBe(1);
    expect(s.conversion).toBe(100);
    expect(refs.listSignups('ads1').items.map((i) => i.username).sort()).toEqual(['alice', 'bob']);
  });

  it('выключенная ссылка не считает клики и регистрации', () => {
    refs.createLink({ name: 'Ads', code: 'ads1' });
    refs.updateLink('ads1', { active: false });
    expect(refs.recordClick('ads1')).toBe(false);
    expect(refs.recordSignup('alice', 'ads1', 'web')).toBe(false);
  });

  it('окна 24ч / 7д', () => {
    refs.createLink({ name: 'Ads', code: 'ads1' });
    const now = Date.UTC(2026, 10, 24, 12);
    refs.recordSignup('a', 'ads1', 'web', now - 60 * 60 * 1000);
    refs.recordSignup('b', 'ads1', 'web', now - 3 * 24 * 60 * 60 * 1000);
    refs.recordSignup('c', 'ads1', 'web', now - 20 * 24 * 60 * 60 * 1000);
    const [s] = refs.listLinksWithStats(now);
    expect([s.signups, s.signups24h, s.signups7d]).toEqual([3, 1, 2]);
  });

  it('публичная статистика по токену без имён пользователей', () => {
    const l = refs.createLink({ name: 'Ads', code: 'ads1' });
    const now = Date.UTC(2026, 10, 24, 12);
    refs.recordClick('ads1', now);
    refs.recordSignup('secret_user', 'ads1', 'web', now);
    const st = refs.getPublicStats(l.statsToken, 3, now)!;
    expect(st.series).toHaveLength(3);
    expect(st.series[2]).toEqual({ day: '2026-11-24', clicks: 1, signups: 1 });
    expect(JSON.stringify(st)).not.toContain('secret_user');
    expect(refs.getPublicStats('wrong-token-123456', 3, now)).toBeNull();
    expect(refs.getPublicStats('x', 3, now)).toBeNull();
  });

  it('удаление ссылки чистит клики', () => {
    refs.createLink({ name: 'Ads', code: 'ads1' });
    refs.recordClick('ads1');
    expect(refs.deleteLink('ads1')).toBe(true);
    expect(refs.deleteLink('ads1')).toBe(false);
    expect(refs.listLinksWithStats()).toHaveLength(0);
  });
});

describe('telegram auth keys', () => {
  let store: ReturnType<typeof createTelegramAuthStore>;
  beforeEach(() => {
    store = createTelegramAuthStore(new Database(':memory:'));
  });

  it('ключ одноразовый и принимается в разном написании', () => {
    const { display, key } = store.issueKey({ telegramId: '1', tgUsername: 'bob' });
    expect(display).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(normalizeKey(display.toLowerCase())).toBe(key);
    expect(formatKey(key)).toBe(display);
    expect(store.peekKey(display)?.telegramId).toBe('1');
    expect(store.consumeKey(` ${display.toLowerCase()} `)?.tgUsername).toBe('bob');
    expect(store.consumeKey(display)).toBeNull();
  });

  it('ключ истекает', () => {
    const t = 1_000_000;
    const { display } = store.issueKey({ telegramId: '1' }, t);
    expect(store.peekKey(display, t + KEY_TTL_MS - 1)).not.toBeNull();
    expect(store.consumeKey(display, t + KEY_TTL_MS + 1)).toBeNull();
  });

  it('новый ключ аннулирует старый и сохраняет реф-код', () => {
    const a = store.issueKey({ telegramId: '1', refCode: 'ads1' });
    const b = store.issueKey({ telegramId: '1' });
    expect(store.peekKey(a.display)).toBeNull();
    expect(store.peekKey(b.display)?.refCode).toBe('ads1');
  });

  it('мусорные ключи отвергаются', () => {
    expect(store.peekKey('')).toBeNull();
    expect(store.peekKey('ABC')).toBeNull();
    expect(store.peekKey('00000-00000')).toBeNull();
    expect(store.peekKey({} as any)).toBeNull();
  });

  it('привязка: один Telegram — один аккаунт и наоборот', () => {
    expect(store.link('1', 'alice', 'al', true)).toBe(true);
    expect(store.link('1', 'bob')).toBe(false);
    expect(store.link('2', 'alice')).toBe(false);
    expect(store.getUsernameByTelegramId('1')).toBe('alice');
    expect(store.getLinkByUsername('alice')).toMatchObject({ telegramId: '1', createdViaTelegram: true });
    store.renameUser('alice', 'alice2');
    expect(store.getUsernameByTelegramId('1')).toBe('alice2');
    store.deleteUser('alice2');
    expect(store.getUsernameByTelegramId('1')).toBeNull();
  });

  it('подсказка имени из @username', () => {
    expect(suggestUsername('Cool_User')).toBe('cool_user');
    expect(suggestUsername('ab')).toBe('');
    expect(suggestUsername('')).toBe('');
  });
});

describe('telegram bot handler', () => {
  function setup() {
    const d = new Database(':memory:');
    const store = createTelegramAuthStore(d);
    const refs = createReferralStore(d);
    refs.createLink({ name: 'Ads', code: 'ads1' });
    const sent: { chat: number; text: string }[] = [];
    const handle = createBotHandler({
      store,
      refs,
      siteUrl: () => 'https://cbios.ru',
      send: async (chat, text) => void sent.push({ chat, text }),
    });
    const msg = (text: string, id = 7, type = 'private') => ({
      update_id: 1,
      message: { text, chat: { id, type }, from: { id, username: 'bob' } },
    });
    return { store, sent, handle, msg };
  }

  it('/start выдаёт рабочий ключ', async () => {
    const { handle, msg, sent, store } = setup();
    await handle(msg('/start'));
    const key = sent[0].text.match(/<code>([A-Z2-9-]+)<\/code>/)![1];
    expect(store.peekKey(key)?.telegramId).toBe('7');
  });

  it('/start ref_<код> привязывает реф к ключу; неизвестный код игнорируется', async () => {
    const { handle, msg, sent, store } = setup();
    await handle(msg('/start ref_ads1'));
    const key = sent[0].text.match(/<code>([A-Z2-9-]+)<\/code>/)![1];
    expect(store.peekKey(key)?.refCode).toBe('ads1');
    await handle(msg('/start ref_nope', 8));
    const key2 = sent[1].text.match(/<code>([A-Z2-9-]+)<\/code>/)![1];
    expect(store.peekKey(key2)?.refCode).toBe('');
  });

  it('игнорирует группы и ботов, на прочее отвечает подсказкой', async () => {
    const { handle, msg, sent } = setup();
    await handle(msg('/start', 7, 'group'));
    expect(sent).toHaveLength(0);
    await handle(msg('привет'));
    expect(sent[0].text).toContain('/start');
  });

  it('не больше 5 ключей за 10 минут', async () => {
    const { handle, msg, sent } = setup();
    for (let i = 0; i < 6; i++) await handle(msg('/start'));
    expect(sent[5].text).toContain('Слишком много');
  });
});
