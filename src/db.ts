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

export function saveBio(username: string, config: BioConfig) {
  db.prepare('INSERT INTO bios (username, data) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data').run(username, JSON.stringify(config));
}

export function addAnalytic(username: string, record: VisitRecord) {
  db.prepare('INSERT INTO analytics (username, timestamp, referrer, device, browser, country) VALUES (?, ?, ?, ?, ?, ?)').run(
    username, record.timestamp, record.referrer, record.device, record.browser, record.country
  );
  
  // Prune (keep last 5000)
  db.prepare(`
    DELETE FROM analytics WHERE username = ? AND id NOT IN (
      SELECT id FROM analytics WHERE username = ? ORDER BY id DESC LIMIT 5000
    )
  `).run(username, username);
}

export function getAnalytics(username: string): VisitRecord[] {
  return db.prepare('SELECT timestamp, referrer, device, browser, country FROM analytics WHERE username = ? ORDER BY timestamp ASC').all(username) as VisitRecord[];
}

