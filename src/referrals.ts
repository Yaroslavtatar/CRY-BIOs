import type Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Реферальные ссылки для рекламы: у каждого рекламщика своя ссылка `/?ref=<code>`,
 * мы считаем переходы и регистрации. Источник регистрации: 'web' (форма) или 'telegram' (бот).
 */

export type SignupSource = 'web' | 'telegram';

export interface ReferralLink {
  code: string;
  name: string;
  note: string;
  statsToken: string;
  active: boolean;
  createdAt: string;
}

export interface ReferralLinkStats extends ReferralLink {
  clicks: number;
  signups: number;
  signups24h: number;
  signups7d: number;
  telegramSignups: number;
  /** Регистрации / переходы, % (null, если переходов не было) */
  conversion: number | null;
}

export interface ReferralSignup {
  username: string;
  code: string;
  source: SignupSource;
  createdAt: string;
}

export const REF_CODE_RE = /^[a-z0-9_-]{3,32}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function normalizeRefCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const code = raw.trim().toLowerCase();
  return REF_CODE_RE.test(code) ? code : '';
}

function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

export function initReferralSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_links (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      stats_token TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_referral_clicks_code_ts ON referral_clicks(code, ts);
    CREATE TABLE IF NOT EXISTS referral_signups (
      username TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_referral_signups_code ON referral_signups(code, created_at);
  `);
}

function rowToLink(r: any): ReferralLink {
  return {
    code: r.code,
    name: r.name,
    note: r.note,
    statsToken: r.stats_token,
    active: !!r.active,
    createdAt: r.created_at,
  };
}

export class ReferralError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function createReferralStore(db: Database.Database) {
  initReferralSchema(db);

  const getLink = (code: string): ReferralLink | null => {
    const c = normalizeRefCode(code);
    if (!c) return null;
    const row = db.prepare('SELECT * FROM referral_links WHERE code = ?').get(c);
    return row ? rowToLink(row) : null;
  };

  return {
    getLink,

    createLink(input: { name: string; code?: string; note?: string }): ReferralLink {
      const name = (input.name || '').trim().slice(0, 80);
      if (!name) throw new ReferralError('Укажите название (имя рекламщика или кампании)');
      let code = '';
      if (input.code && input.code.trim()) {
        code = normalizeRefCode(input.code);
        if (!code) throw new ReferralError('Код: 3–32 символа, латиница в нижнем регистре, цифры, _ или -');
        if (getLink(code)) throw new ReferralError('Такой код уже существует', 409);
      } else {
        for (let i = 0; i < 10 && !code; i++) {
          const c = randomCode();
          if (!getLink(c)) code = c;
        }
        if (!code) throw new ReferralError('Не удалось сгенерировать код, попробуйте ещё раз', 500);
      }
      const link: ReferralLink = {
        code,
        name,
        note: (input.note || '').trim().slice(0, 300),
        statsToken: crypto.randomBytes(18).toString('base64url'),
        active: true,
        createdAt: new Date().toISOString(),
      };
      db.prepare(
        'INSERT INTO referral_links (code, name, note, stats_token, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      ).run(link.code, link.name, link.note, link.statsToken, link.createdAt);
      return link;
    },

    updateLink(code: string, patch: { name?: string; note?: string; active?: boolean }): ReferralLink {
      const cur = getLink(code);
      if (!cur) throw new ReferralError('Ссылка не найдена', 404);
      const name = patch.name !== undefined ? patch.name.trim().slice(0, 80) : cur.name;
      if (!name) throw new ReferralError('Название не может быть пустым');
      const note = patch.note !== undefined ? patch.note.trim().slice(0, 300) : cur.note;
      const active = patch.active !== undefined ? patch.active : cur.active;
      db.prepare('UPDATE referral_links SET name = ?, note = ?, active = ? WHERE code = ?').run(
        name, note, active ? 1 : 0, cur.code,
      );
      return { ...cur, name, note, active };
    },

    /** Удаляет ссылку и счётчик переходов; регистрации остаются в истории (код больше не активен). */
    deleteLink(code: string): boolean {
      const c = normalizeRefCode(code);
      if (!c) return false;
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM referral_clicks WHERE code = ?').run(c);
        return db.prepare('DELETE FROM referral_links WHERE code = ?').run(c).changes > 0;
      });
      return tx();
    },

    /** Переход по ссылке. Неактивные и неизвестные коды не считаются. */
    recordClick(code: string, now = Date.now()): boolean {
      const link = getLink(code);
      if (!link || !link.active) return false;
      db.prepare('INSERT INTO referral_clicks (code, ts) VALUES (?, ?)').run(link.code, now);
      return true;
    },

    /** Привязывает нового пользователя к ссылке. Один пользователь — одна атрибуция. */
    recordSignup(username: string, code: string, source: SignupSource, now = Date.now()): boolean {
      const link = getLink(code);
      if (!link || !link.active) return false;
      const res = db
        .prepare('INSERT OR IGNORE INTO referral_signups (username, code, source, created_at) VALUES (?, ?, ?, ?)')
        .run(username, link.code, source, new Date(now).toISOString());
      return res.changes > 0;
    },

    getSignupFor(username: string): ReferralSignup | null {
      const r = db.prepare('SELECT * FROM referral_signups WHERE username = ?').get(username) as any;
      return r ? { username: r.username, code: r.code, source: r.source, createdAt: r.created_at } : null;
    },

    listSignups(code: string, limit = 100, offset = 0): { total: number; items: ReferralSignup[] } {
      const c = normalizeRefCode(code);
      const total = (db.prepare('SELECT COUNT(*) AS n FROM referral_signups WHERE code = ?').get(c) as any).n as number;
      const rows = db
        .prepare('SELECT * FROM referral_signups WHERE code = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(c, Math.min(Math.max(limit, 1), 500), Math.max(offset, 0)) as any[];
      return {
        total,
        items: rows.map((r) => ({ username: r.username, code: r.code, source: r.source, createdAt: r.created_at })),
      };
    },

    listLinksWithStats(now = Date.now()): ReferralLinkStats[] {
      const since24 = new Date(now - DAY_MS).toISOString();
      const since7 = new Date(now - 7 * DAY_MS).toISOString();
      const rows = db
        .prepare(
          `SELECT l.*,
            (SELECT COUNT(*) FROM referral_clicks c WHERE c.code = l.code) AS clicks,
            (SELECT COUNT(*) FROM referral_signups s WHERE s.code = l.code) AS signups,
            (SELECT COUNT(*) FROM referral_signups s WHERE s.code = l.code AND s.created_at >= ?) AS signups24h,
            (SELECT COUNT(*) FROM referral_signups s WHERE s.code = l.code AND s.created_at >= ?) AS signups7d,
            (SELECT COUNT(*) FROM referral_signups s WHERE s.code = l.code AND s.source = 'telegram') AS tg
           FROM referral_links l ORDER BY l.created_at DESC`,
        )
        .all(since24, since7) as any[];
      return rows.map((r) => ({
        ...rowToLink(r),
        clicks: r.clicks,
        signups: r.signups,
        signups24h: r.signups24h,
        signups7d: r.signups7d,
        telegramSignups: r.tg,
        conversion: r.clicks > 0 ? Math.min(100, Math.round((r.signups / r.clicks) * 1000) / 10) : null,
      }));
    },

    /** Публичная статистика для рекламщика по секретному токену: только числа, без имён пользователей. */
    getPublicStats(statsToken: string, days = 14, now = Date.now()) {
      if (typeof statsToken !== 'string' || statsToken.length < 10 || statsToken.length > 64) return null;
      const row = db.prepare('SELECT * FROM referral_links WHERE stats_token = ?').get(statsToken) as any;
      if (!row) return null;
      const link = rowToLink(row);
      const stats = this.listLinksWithStats(now).find((l) => l.code === link.code)!;
      const from = now - (days - 1) * DAY_MS;
      const startDay = new Date(from).toISOString().slice(0, 10);
      const signups = db
        .prepare('SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM referral_signups WHERE code = ? AND substr(created_at, 1, 10) >= ? GROUP BY day')
        .all(link.code, startDay) as { day: string; n: number }[];
      const clicks = db
        .prepare("SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM referral_clicks WHERE code = ? AND ts >= ? GROUP BY day")
        .all(link.code, from) as { day: string; n: number }[];
      const sMap = new Map(signups.map((r) => [r.day, r.n]));
      const cMap = new Map(clicks.map((r) => [r.day, r.n]));
      const series = Array.from({ length: days }, (_, i) => {
        const day = new Date(from + i * DAY_MS).toISOString().slice(0, 10);
        return { day, clicks: cMap.get(day) ?? 0, signups: sMap.get(day) ?? 0 };
      });
      return {
        name: stats.name,
        active: stats.active,
        clicks: stats.clicks,
        signups: stats.signups,
        signups24h: stats.signups24h,
        signups7d: stats.signups7d,
        conversion: stats.conversion,
        series,
      };
    },

    renameUser(oldName: string, newName: string) {
      db.prepare('UPDATE referral_signups SET username = ? WHERE username = ?').run(newName, oldName);
    },

    deleteUser(username: string) {
      db.prepare('DELETE FROM referral_signups WHERE username = ?').run(username);
    },
  };
}

export type ReferralStore = ReturnType<typeof createReferralStore>;
