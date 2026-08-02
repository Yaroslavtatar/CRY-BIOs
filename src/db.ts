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
`);

try {
  db.exec("ALTER TABLE analytics ADD COLUMN host TEXT DEFAULT ''");
} catch (e) {
  // Column already exists
}

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
  return db.prepare('SELECT * FROM users WHERE token = ?').get(token) as any;
}

export function createUser(username: string, passwordHash: string, token: string) {
  db.prepare('INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)').run(username, passwordHash, token);
}

export function updateUserToken(username: string, token: string) {
  db.prepare('UPDATE users SET token = ? WHERE username = ?').run(token, username);
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

export function exportDatabase(options?: { includeAnalytics?: boolean }) {
  const users = db.prepare('SELECT * FROM users').all();
  const bios = db.prepare('SELECT * FROM bios').all();
  const includeAnalytics = options?.includeAnalytics !== false;
  const analytics = includeAnalytics
    ? db.prepare('SELECT * FROM analytics').all()
    : [];
  return { users, bios, analytics };
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


