import type Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Вход и регистрация через Telegram-бота по одноразовому ключу.
 *
 * Поток: пользователь пишет боту /start (можно со ссылки t.me/<bot>?start=ref_<код>) →
 * бот присылает ключ вида ABCDE-FGHJK (живёт 10 минут, одноразовый) → пользователь вводит ключ на сайте.
 * Ключ выдаётся только тому Telegram-аккаунту, который написал боту, поэтому подсунуть жертве
 * «чужую» сессию (login CSRF) нельзя: сайт не создаёт ключ, его создаёт бот.
 * В БД лежит только sha256 ключа.
 */

export const KEY_TTL_MS = 10 * 60 * 1000;
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I, O, 0, 1
const KEY_LEN = 10;

export interface TelegramKeyRow {
  telegramId: string;
  tgUsername: string;
  refCode: string;
  expiresAt: number;
}

export function normalizeKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const k = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (k.length !== KEY_LEN) return '';
  for (const ch of k) if (!KEY_ALPHABET.includes(ch)) return '';
  return k;
}

export function formatKey(key: string): string {
  return `${key.slice(0, 5)}-${key.slice(5)}`;
}

const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

function generateKey(): string {
  let out = '';
  for (let i = 0; i < KEY_LEN; i++) out += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
  return out;
}

/** Подходящее имя пользователя из @username Telegram (или '' если не подходит). */
export function suggestUsername(tgUsername: string): string {
  const cleaned = (tgUsername || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return /^[a-z0-9_-]{3,15}$/.test(cleaned) ? cleaned : '';
}

export function initTelegramSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_accounts (
      telegram_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      tg_username TEXT NOT NULL DEFAULT '',
      created_via_telegram INTEGER NOT NULL DEFAULT 0,
      linked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_keys (
      key_hash TEXT PRIMARY KEY,
      telegram_id TEXT NOT NULL,
      tg_username TEXT NOT NULL DEFAULT '',
      ref_code TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_keys_tid ON telegram_keys(telegram_id);
  `);
}

export function createTelegramAuthStore(db: Database.Database) {
  initTelegramSchema(db);

  const cleanup = (now: number) => db.prepare('DELETE FROM telegram_keys WHERE expires_at < ?').run(now);

  const toRow = (r: any): TelegramKeyRow => ({
    telegramId: r.telegram_id,
    tgUsername: r.tg_username,
    refCode: r.ref_code,
    expiresAt: r.expires_at,
  });

  return {
    /**
     * Выдаёт новый ключ для Telegram-аккаунта. Старые ключи этого аккаунта аннулируются.
     * Если реф-код не передан, сохраняется код из предыдущего ещё живого ключа.
     */
    issueKey(input: { telegramId: string; tgUsername?: string; refCode?: string }, now = Date.now()) {
      cleanup(now);
      const prev = db
        .prepare('SELECT ref_code FROM telegram_keys WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(input.telegramId) as { ref_code: string } | undefined;
      const refCode = input.refCode || prev?.ref_code || '';
      const key = generateKey();
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM telegram_keys WHERE telegram_id = ?').run(input.telegramId);
        db.prepare(
          'INSERT INTO telegram_keys (key_hash, telegram_id, tg_username, ref_code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(hashKey(key), input.telegramId, (input.tgUsername || '').slice(0, 64), refCode, now + KEY_TTL_MS, now);
      });
      tx();
      return { key, display: formatKey(key), expiresAt: now + KEY_TTL_MS };
    },

    /** Проверить ключ, не расходуя его (нужно, пока пользователь выбирает имя при регистрации). */
    peekKey(rawKey: string, now = Date.now()): TelegramKeyRow | null {
      const key = normalizeKey(rawKey);
      if (!key) return null;
      const row = db.prepare('SELECT * FROM telegram_keys WHERE key_hash = ?').get(hashKey(key)) as any;
      if (!row || row.expires_at < now) return null;
      return toRow(row);
    },

    /** Атомарно расходует ключ (одноразовый). */
    consumeKey(rawKey: string, now = Date.now()): TelegramKeyRow | null {
      const key = normalizeKey(rawKey);
      if (!key) return null;
      const h = hashKey(key);
      const tx = db.transaction(() => {
        const row = db.prepare('SELECT * FROM telegram_keys WHERE key_hash = ?').get(h) as any;
        if (!row) return null;
        db.prepare('DELETE FROM telegram_keys WHERE key_hash = ?').run(h);
        if (row.expires_at < now) return null;
        return toRow(row);
      });
      return tx();
    },

    getUsernameByTelegramId(telegramId: string): string | null {
      const r = db.prepare('SELECT username FROM telegram_accounts WHERE telegram_id = ?').get(telegramId) as any;
      return r?.username ?? null;
    },

    getLinkByUsername(username: string): { telegramId: string; tgUsername: string; createdViaTelegram: boolean } | null {
      const r = db.prepare('SELECT * FROM telegram_accounts WHERE username = ?').get(username) as any;
      return r ? { telegramId: r.telegram_id, tgUsername: r.tg_username, createdViaTelegram: !!r.created_via_telegram } : null;
    },

    /** Привязка Telegram к аккаунту. false — этот Telegram или этот аккаунт уже привязаны. */
    link(telegramId: string, username: string, tgUsername = '', createdViaTelegram = false): boolean {
      try {
        db.prepare(
          'INSERT INTO telegram_accounts (telegram_id, username, tg_username, created_via_telegram, linked_at) VALUES (?, ?, ?, ?, ?)',
        ).run(telegramId, username, tgUsername.slice(0, 64), createdViaTelegram ? 1 : 0, new Date().toISOString());
        return true;
      } catch {
        return false;
      }
    },

    renameUser(oldName: string, newName: string) {
      db.prepare('UPDATE telegram_accounts SET username = ? WHERE username = ?').run(newName, oldName);
    },

    deleteUser(username: string) {
      db.prepare('DELETE FROM telegram_accounts WHERE username = ?').run(username);
    },

    stats(now = Date.now()) {
      cleanup(now);
      const linked = (db.prepare('SELECT COUNT(*) AS n FROM telegram_accounts').get() as any).n as number;
      const viaTg = (db.prepare('SELECT COUNT(*) AS n FROM telegram_accounts WHERE created_via_telegram = 1').get() as any).n as number;
      const pendingKeys = (db.prepare('SELECT COUNT(*) AS n FROM telegram_keys').get() as any).n as number;
      return { linked, registeredViaTelegram: viaTg, pendingKeys };
    },
  };
}

export type TelegramAuthStore = ReturnType<typeof createTelegramAuthStore>;
