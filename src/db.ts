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
}

ensureUserSecurityColumns();

export const SESSION_TTL_DAYS = 30;

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
      insertUser.run(username, u.passwordHash, u.token || crypto.randomUUID());
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
  if (!token) return null;
  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(token) as any;
  if (!user || !user.token) return null;
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
  ).run(username, passwordHash, token, expires.toISOString());
}

export function updateUserToken(username: string, token: string, expiresInDays = SESSION_TTL_DAYS) {
  const expires = new Date();
  expires.setDate(expires.getDate() + expiresInDays);
  db.prepare(
    'UPDATE users SET token = ?, token_expires_at = ?, failed_login_attempts = 0, locked_until = NULL WHERE username = ?'
  ).run(token, expires.toISOString(), username);
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
    
    // Create new
    db.prepare('INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)').run(newUsername, user.password_hash, user.token);
    
    // Copy bio
    const bioRow = db.prepare('SELECT data FROM bios WHERE username = ?').get(oldUsername) as any;
    if (bioRow) {
      const bioObj = JSON.parse(bioRow.data);
      bioObj.username = newUsername;
      if (bioObj.displayName === oldUsername) {
        bioObj.displayName = newUsername;
      }
      db.prepare('INSERT INTO bios (username, data) VALUES (?, ?)').run(newUsername, JSON.stringify(bioObj));
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

  const bios = getAllBios();
  return (
    bios.find(b => b.aliasSlug && b.aliasSlug.toLowerCase().trim() === normalized) || null
  );
}

export function resolveSlugToUsername(slug: string): string | null {
  const bio = getBioBySlug(slug);
  return bio?.username || null;
}

export function isAliasSlugTaken(slug: string, excludeUsername?: string): boolean {
  const normalized = slug.toLowerCase().trim();
  if (!normalized) return false;

  const bios = getAllBios();
  for (const bio of bios) {
    if (excludeUsername && bio.username.toLowerCase() === excludeUsername.toLowerCase()) continue;
    if (bio.username.toLowerCase() === normalized) return true;
    if (bio.aliasSlug && bio.aliasSlug.toLowerCase().trim() === normalized) return true;
  }
  return false;
}

export function getBioByCustomDomain(host: string): BioConfig | null {
  const normalized = host.toLowerCase().trim();
  if (!normalized) return null;
  const bios = getAllBios();
  return bios.find(b => b.customDomain && b.customDomain.toLowerCase().trim() === normalized) || null;
}

export function getAllBios(): BioConfig[] {
  const rows = db.prepare('SELECT data FROM bios').all() as { data: string }[];
  return rows.map(r => JSON.parse(r.data));
}

export function getAllUsersWithStats() {
  const users = db.prepare('SELECT username FROM users').all() as { username: string }[];
  return users.map(u => {
    const bioRow = db.prepare('SELECT data FROM bios WHERE username = ?').get(u.username) as any;
    const bio = bioRow ? JSON.parse(bioRow.data) : null;
    const visitsCount = (db.prepare('SELECT COUNT(*) as count FROM analytics WHERE username = ?').get(u.username) as any).count;
    return {
      username: u.username,
      displayName: bio?.displayName || u.username,
      avatarUrl: bio?.avatarUrl || '',
      verified: bio?.verified || false,
      visitsCount
    };
  });
}

export function saveBio(username: string, config: BioConfig) {
  db.prepare('INSERT INTO bios (username, data) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data').run(username, JSON.stringify(config));
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

export function exportDatabase(options?: { includeAnalytics?: boolean; includeSecrets?: boolean }) {
  const users = db.prepare('SELECT * FROM users').all() as any[];
  const bios = db.prepare('SELECT * FROM bios').all();
  const includeAnalytics = options?.includeAnalytics !== false;
  const includeSecrets = options?.includeSecrets === true;
  const analytics = includeAnalytics
    ? db.prepare('SELECT * FROM analytics').all()
    : [];
  const sanitizedUsers = includeSecrets
    ? users
    : users.map(u => ({
        username: u.username,
        password_hash: u.password_hash,
        token: '[REDACTED]',
        token_expires_at: u.token_expires_at ?? null,
        failed_login_attempts: u.failed_login_attempts ?? 0,
        locked_until: u.locked_until ?? null,
      }));
  return { users: sanitizedUsers, bios, analytics };
}

export function importDatabase(dump: { users?: any[], bios?: any[], analytics?: any[] }) {
  const transaction = db.transaction(() => {
    if (dump.users) {
      db.prepare('DELETE FROM users').run();
      const insertUser = db.prepare('INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)');
      for (const u of dump.users) {
        insertUser.run(u.username, u.password_hash, u.token);
      }
    }
    if (dump.bios) {
      db.prepare('DELETE FROM bios').run();
      const insertBio = db.prepare('INSERT INTO bios (username, data) VALUES (?, ?)');
      for (const b of dump.bios) {
        insertBio.run(b.username, b.data);
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
