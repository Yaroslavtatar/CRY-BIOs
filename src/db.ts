import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { BioConfig, VisitRecord } from './types';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(path.join(DATA_DIR, 'biogun.db'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    token TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bios (
    username TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    referrer TEXT NOT NULL,
    device TEXT NOT NULL,
    browser TEXT NOT NULL,
    country TEXT NOT NULL,
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE analytics ADD COLUMN host TEXT DEFAULT ''");
} catch (e) {
  // Column already exists
}

function ensureUserSecurityColumns() {
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const names = new Set(columns.map(c => c.name));
  if (!names.has('token_expires_at')) {
    db.exec('ALTER TABLE users ADD COLUMN token_expires_at TEXT');
  }
  if (!names.has('failed_login_attempts')) {
    db.exec('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
  }
  if (!names.has('locked_until')) {
    db.exec('ALTER TABLE users ADD COLUMN locked_until TEXT');
  }
  if (!names.has('banned')) {
    db.exec('ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0');
  }
  if (!names.has('ban_reason')) {
    db.exec("ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT ''");
  }
}

ensureUserSecurityColumns();

export const SESSION_TTL_DAYS = 30;

/** В БД хранится только sha256(токена); сам токен знает только клиент. */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const TOKEN_HASH_RE = /^[a-f0-9]{64}$/;

/** Миграция: открытые токены → sha256, заглушки/мусор → '' (сессия недействительна). */
function migrateSessionTokens() {
  const rows = db.prepare('SELECT username, token FROM users').all() as { username: string; token: string }[];
  const update = db.prepare('UPDATE users SET token = ? WHERE username = ?');
  db.transaction(() => {
    for (const r of rows) {
      const t = r.token || '';
      if (t === '' || TOKEN_HASH_RE.test(t)) continue;
      if (t === '[REDACTED]') update.run('', r.username);
      else update.run(hashSessionToken(t), r.username);
    }
  })();
  // Токен уникален (пустые значения — «нет сессии» — не учитываются)
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_token ON users(token) WHERE token != ''");
}

migrateSessionTokens();

// Индексируемые копии alias_slug / custom_domain (вместо JSON.parse всех профилей на каждый запрос)
function ensureBioIndexColumns() {
  const columns = db.prepare('PRAGMA table_info(bios)').all() as { name: string }[];
  const names = new Set(columns.map(c => c.name));
  if (!names.has('alias_slug')) db.exec('ALTER TABLE bios ADD COLUMN alias_slug TEXT');
  if (!names.has('custom_domain')) db.exec('ALTER TABLE bios ADD COLUMN custom_domain TEXT');
  const rows = db.prepare('SELECT username, data FROM bios WHERE alias_slug IS NULL AND custom_domain IS NULL').all() as { username: string; data: string }[];
  const upd = db.prepare('UPDATE bios SET alias_slug = ?, custom_domain = ? WHERE username = ?');
  db.transaction(() => {
    for (const r of rows) {
      try {
        const b = JSON.parse(r.data);
        upd.run(normIndexValue(b.aliasSlug), normIndexValue(b.customDomain), r.username);
      } catch { /* битый JSON не должен ронять запуск */ }
    }
  })();
  db.exec('CREATE INDEX IF NOT EXISTS idx_bios_alias_slug ON bios(alias_slug)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bios_custom_domain ON bios(custom_domain)');
}

function normIndexValue(v: unknown): string {
  return typeof v === 'string' ? v.toLowerCase().trim() : '';
}

ensureBioIndexColumns();

// MIGRATION FROM JSON IF DB IS EMPTY
const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (countUsers.count === 0) {
  const BIOS_PATH = path.join(DATA_DIR, 'bios.json');
  const USERS_PATH = path.join(DATA_DIR, 'users.json');
  const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics.json');

  if (fs.existsSync(USERS_PATH)) {
    const rawUsers = fs.readFileSync(USERS_PATH, 'utf-8');
    const usersData = JSON.parse(rawUsers);
    const insertUser = db.prepare('INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)');
    for (const [username, u] of Object.entries<any>(usersData)) {
      insertUser.run(username, u.passwordHash, hashSessionToken(u.token || crypto.randomUUID()));
    }
  }

  if (fs.existsSync(BIOS_PATH)) {
    const rawBios = fs.readFileSync(BIOS_PATH, 'utf-8');
    const biosData = JSON.parse(rawBios);
    const insertBio = db.prepare('INSERT INTO bios (username, data) VALUES (?, ?)');
    for (const [username, b] of Object.entries<any>(biosData)) {
      insertBio.run(username, JSON.stringify(b));
    }
  }

  if (fs.existsSync(ANALYTICS_PATH)) {
    const rawAnalytics = fs.readFileSync(ANALYTICS_PATH, 'utf-8');
    const analyticsData = JSON.parse(rawAnalytics);
    const insertAnalytic = db.prepare('INSERT INTO analytics (username, timestamp, referrer, device, browser, country) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [username, records] of Object.entries<VisitRecord[]>(analyticsData)) {
      for (const r of records) {
        insertAnalytic.run(username, r.timestamp, r.referrer, r.device, r.browser, r.country);
      }
    }
  }
}

// Data Access API
export function getUser(username: string) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
}

export function getUserByToken(token: string) {
  if (!token || typeof token !== 'string' || token === '[REDACTED]') return null;
  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(hashSessionToken(token)) as any;
  if (!user || !user.token) return null;
  if (user.banned) return null;
  if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
    return null;
  }
  return user;
}

export function createUser(username: string, passwordHash: string, token: string) {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  db.prepare(
    'INSERT INTO users (username, password_hash, token, token_expires_at, failed_login_attempts, locked_until) VALUES (?, ?, ?, ?, 0, NULL)'
  ).run(username, passwordHash, hashSessionToken(token), expires.toISOString());
}

export function updateUserToken(username: string, token: string, expiresInDays = SESSION_TTL_DAYS) {
  const expires = new Date();
  expires.setDate(expires.getDate() + expiresInDays);
  db.prepare(
    'UPDATE users SET token = ?, token_expires_at = ?, failed_login_attempts = 0, locked_until = NULL WHERE username = ?'
  ).run(hashSessionToken(token), expires.toISOString(), username);
}

export function clearUserToken(username: string) {
  db.prepare(
    'UPDATE users SET token = ?, token_expires_at = NULL, failed_login_attempts = 0, locked_until = NULL WHERE username = ?'
  ).run('', username);
}

export function incrementFailedLogin(username: string, maxAttempts: number, lockoutMinutes: number) {
  const user = getUser(username);
  if (!user) return;
  const attempts = (user.failed_login_attempts || 0) + 1;
  if (attempts >= maxAttempts) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMinutes);
    db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE username = ?')
      .run(attempts, lockedUntil.toISOString(), username);
  } else {
    db.prepare('UPDATE users SET failed_login_attempts = ? WHERE username = ?').run(attempts, username);
  }
}

export function clearFailedLogin(username: string) {
  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?').run(username);
}

export function invalidateUserSessions(username: string) {
  clearUserToken(username);
}

export function updateUsername(oldUsername: string, newUsername: string) {
  const transaction = db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(oldUsername) as any;
    if (!user) return;
    
    // Токен уникален: освобождаем его у старой записи до вставки новой
    db.prepare("UPDATE users SET token = '' WHERE username = ?").run(oldUsername);
    db.prepare('INSERT INTO users (username, password_hash, token, token_expires_at) VALUES (?, ?, ?, ?)').run(newUsername, user.password_hash, user.token, user.token_expires_at ?? null);
    
    // Copy bio
    const bioRow = db.prepare('SELECT data FROM bios WHERE username = ?').get(oldUsername) as any;
    if (bioRow) {
      const bioObj = JSON.parse(bioRow.data);
      bioObj.username = newUsername;
      if (bioObj.displayName === oldUsername) {
        bioObj.displayName = newUsername;
      }
      db.prepare('INSERT INTO bios (username, data, alias_slug, custom_domain) VALUES (?, ?, ?, ?)').run(newUsername, JSON.stringify(bioObj), normIndexValue(bioObj.aliasSlug), normIndexValue(bioObj.customDomain));
    }
    
    // Update analytics
    db.prepare('UPDATE analytics SET username = ? WHERE username = ?').run(newUsername, oldUsername);
    
    // Delete old (this cascades to old bio)
    db.prepare('DELETE FROM users WHERE username = ?').run(oldUsername);
  });
  transaction();
}

export function getBio(username: string): BioConfig | null {
  const row = db.prepare('SELECT data FROM bios WHERE username = ?').get(username) as { data: string };
  return row ? JSON.parse(row.data) : null;
}

export function getBioBySlug(slug: string): BioConfig | null {
  const normalized = slug.toLowerCase().trim();
  if (!normalized) return null;

  const byUsername = getBio(normalized);
  if (byUsername) return byUsername;

  const row = db.prepare('SELECT data FROM bios WHERE alias_slug = ? LIMIT 1').get(normalized) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function resolveSlugToUsername(slug: string): string | null {
  const bio = getBioBySlug(slug);
  return bio?.username || null;
}

export function isAliasSlugTaken(slug: string, excludeUsername?: string): boolean {
  const normalized = slug.toLowerCase().trim();
  if (!normalized) return false;
  const exclude = (excludeUsername || '').toLowerCase();

  if (normalized !== exclude && db.prepare('SELECT 1 FROM users WHERE username = ?').get(normalized)) return true;
  const row = db.prepare('SELECT username FROM bios WHERE alias_slug = ? AND username != ? LIMIT 1').get(normalized, exclude) as any;
  return !!row;
}

export function isCustomDomainTaken(domain: string, excludeUsername?: string): boolean {
  const normalized = domain.toLowerCase().trim();
  if (!normalized) return false;
  const row = db.prepare('SELECT username FROM bios WHERE custom_domain = ? AND username != ? LIMIT 1').get(normalized, (excludeUsername || '').toLowerCase()) as any;
  return !!row;
}

export function getBioByCustomDomain(host: string): BioConfig | null {
  const normalized = host.toLowerCase().trim();
  if (!normalized) return null;
  const row = db.prepare('SELECT data FROM bios WHERE custom_domain = ? ORDER BY rowid LIMIT 1').get(normalized) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function getAllBios(): BioConfig[] {
  const rows = db.prepare('SELECT data FROM bios').all() as { data: string }[];
  return rows.map(r => JSON.parse(r.data));
}

export function getAllUsersWithStats() {
  const users = db.prepare('SELECT username, banned, ban_reason FROM users').all() as { username: string; banned: number | null; ban_reason: string | null }[];
  return users.map(u => {
    const bioRow = db.prepare('SELECT data FROM bios WHERE username = ?').get(u.username) as any;
    const bio = bioRow ? JSON.parse(bioRow.data) : null;
    const visitsCount = (db.prepare('SELECT COUNT(*) as count FROM analytics WHERE username = ?').get(u.username) as any).count;
    return {
      username: u.username,
      displayName: bio?.displayName || u.username,
      avatarUrl: bio?.avatarUrl || '',
      verified: bio?.verified || false,
      visitsCount,
      banned: Boolean(u.banned),
      banReason: u.ban_reason || '',
    };
  });
}

export function isUserBanned(username: string): boolean {
  const row = db.prepare('SELECT banned FROM users WHERE username = ?').get(username.toLowerCase()) as { banned: number | null } | undefined;
  return Boolean(row?.banned);
}

export function getBannedUsernames(): Set<string> {
  const rows = db.prepare('SELECT username FROM users WHERE banned = 1').all() as { username: string }[];
  return new Set(rows.map(r => r.username));
}

/** Бан закрывает все сессии пользователя и скрывает профиль с публичных страниц. */
export function setUserBanned(username: string, banned: boolean, reason = '') {
  db.prepare(
    banned
      ? "UPDATE users SET banned = 1, ban_reason = ?, token = '', token_expires_at = NULL WHERE username = ?"
      : "UPDATE users SET banned = 0, ban_reason = '' WHERE username = ?"
  ).run(...(banned ? [reason.slice(0, 200), username] : [username]));
}

export function clearAnalytics(username?: string): number {
  const res = username
    ? db.prepare('DELETE FROM analytics WHERE username = ?').run(username)
    : db.prepare('DELETE FROM analytics').run();
  return res.changes;
}

export function getOverviewCounts() {
  const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { c: number }).c;
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const topRows = db
    .prepare('SELECT username, COUNT(*) AS visits FROM analytics GROUP BY username ORDER BY visits DESC LIMIT 5')
    .all() as { username: string; visits: number }[];
  return {
    users: count('SELECT COUNT(*) AS c FROM users'),
    banned: count('SELECT COUNT(*) AS c FROM users WHERE banned = 1'),
    bios: count('SELECT COUNT(*) AS c FROM bios'),
    visitsTotal: count('SELECT COUNT(*) AS c FROM analytics'),
    visits24h: count('SELECT COUNT(*) AS c FROM analytics WHERE timestamp >= ?', since(24 * 3600e3)),
    visits7d: count('SELECT COUNT(*) AS c FROM analytics WHERE timestamp >= ?', since(7 * 24 * 3600e3)),
    topProfiles: topRows,
  };
}

export function saveBio(username: string, config: BioConfig) {
  db.prepare(
    'INSERT INTO bios (username, data, alias_slug, custom_domain) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(username) DO UPDATE SET data = excluded.data, alias_slug = excluded.alias_slug, custom_domain = excluded.custom_domain'
  ).run(username, JSON.stringify(config), normIndexValue(config.aliasSlug), normIndexValue(config.customDomain));
}

export function addAnalytic(username: string, record: VisitRecord) {
  db.prepare('INSERT INTO analytics (username, timestamp, referrer, device, browser, country, host) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    username, record.timestamp, record.referrer, record.device, record.browser, record.country, record.host || ''
  );
  
  // Prune (keep last 5000)
  db.prepare(`
    DELETE FROM analytics WHERE username = ? AND id NOT IN (
      SELECT id FROM analytics WHERE username = ? ORDER BY id DESC LIMIT 5000
    )
  `).run(username, username);
}

export function getAnalytics(username: string): VisitRecord[] {
  return db.prepare('SELECT timestamp, referrer, device, browser, country, host FROM analytics WHERE username = ? ORDER BY timestamp ASC').all(username) as VisitRecord[];
}

export function deleteUser(username: string) {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM bios WHERE username = ?').run(username);
    db.prepare('DELETE FROM analytics WHERE username = ?').run(username);
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
  });
  transaction();
}

export function updateUserPassword(username: string, passwordHash: string) {
  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username);
}

export function updateUserPasswordAndInvalidateSessions(username: string, passwordHash: string) {
  db.prepare(
    'UPDATE users SET password_hash = ?, token = ?, token_expires_at = NULL, failed_login_attempts = 0, locked_until = NULL WHERE username = ?'
  ).run(passwordHash, '', username);
}

export function exportDatabase(options?: { includeAnalytics?: boolean }) {
  const users = db.prepare('SELECT * FROM users').all() as any[];
  const bios = db.prepare('SELECT * FROM bios').all();
  const includeAnalytics = options?.includeAnalytics !== false;
  const analytics = includeAnalytics
    ? db.prepare('SELECT * FROM analytics').all()
    : [];
  // Токены (даже хэшированные) в экспорт не попадают никогда.
  const sanitizedUsers = users.map(u => ({
        username: u.username,
        password_hash: u.password_hash,
        token: '',
        token_expires_at: null,
        failed_login_attempts: u.failed_login_attempts ?? 0,
        locked_until: u.locked_until ?? null,
        banned: u.banned ? 1 : 0,
        ban_reason: u.ban_reason ?? '',
      }));
  return { users: sanitizedUsers, bios, analytics };
}

export function importDatabase(dump: { users?: any[], bios?: any[], analytics?: any[] }) {
  const transaction = db.transaction(() => {
    if (dump.users) {
      db.prepare('DELETE FROM users').run();
      // Сессии из бэкапа никогда не восстанавливаются: все входят заново.
      const insertUser = db.prepare("INSERT INTO users (username, password_hash, token, banned, ban_reason) VALUES (?, ?, '', ?, ?)");
      for (const u of dump.users) {
        insertUser.run(u.username, u.password_hash, u.banned ? 1 : 0, typeof u.ban_reason === 'string' ? u.ban_reason.slice(0, 200) : '');
      }
    }
    if (dump.bios) {
      db.prepare('DELETE FROM bios').run();
      const insertBio = db.prepare('INSERT INTO bios (username, data, alias_slug, custom_domain) VALUES (?, ?, ?, ?)');
      for (const b of dump.bios) {
        let alias = '', domain = '';
        try {
          const parsed = JSON.parse(b.data);
          alias = normIndexValue(parsed.aliasSlug);
          domain = normIndexValue(parsed.customDomain);
        } catch { /* ignore */ }
        insertBio.run(b.username, b.data, alias, domain);
      }
    }
    if (dump.analytics) {
      db.prepare('DELETE FROM analytics').run();
      const insertAnalytic = db.prepare('INSERT INTO analytics (username, timestamp, referrer, device, browser, country, host) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const a of dump.analytics) {
        insertAnalytic.run(a.username, a.timestamp, a.referrer, a.device, a.browser, a.country, a.host || '');
      }
    }
  });
  transaction();
}

export function createOAuthState(username: string, ttlMinutes = 10): string {
  cleanupExpiredOAuthStates();
  const state = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  db.prepare('INSERT INTO oauth_states (state, username, expires_at) VALUES (?, ?, ?)').run(
    state,
    username,
    expiresAt,
  );
  return state;
}

export function consumeOAuthState(state: string): string | null {
  cleanupExpiredOAuthStates();
  const row = db.prepare('SELECT username, expires_at FROM oauth_states WHERE state = ?').get(state) as
    | { username: string; expires_at: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) {
    db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
    return null;
  }
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  return row.username;
}

export function cleanupExpiredOAuthStates(): void {
  db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(Date.now());
}
