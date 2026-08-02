import fs from 'fs';
import path from 'path';
import * as db from './db';

export interface DirectoryStats {
  bytes: number;
  files: number;
}

export function scanDirectoryStats(dir: string): DirectoryStats {
  let bytes = 0;
  let files = 0;

  if (!fs.existsSync(dir)) return { bytes, files };

  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files += 1;
        try {
          bytes += fs.statSync(full).size;
        } catch { /* ignore */ }
      }
    }
  };
  walk(dir);
  return { bytes, files };
}

export function getDbSize(dataDir: string): number {
  const dbPath = path.join(dataDir, 'biogun.db');
  if (!fs.existsSync(dbPath)) return 0;
  return fs.statSync(dbPath).size;
}

export function getLastBackupInfo(backupsDir: string): { at: string | null; size: number | null; path: string | null } {
  const metaPath = path.join(backupsDir, 'last-backup.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return { at: meta.at || null, size: meta.size ?? null, path: meta.path || null };
    } catch { /* fall through */ }
  }

  if (!fs.existsSync(backupsDir)) {
    return { at: null, size: null, path: null };
  }

  const zips = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (zips.length === 0) return { at: null, size: null, path: null };

  const latest = path.join(backupsDir, zips[0].name);
  return {
    at: new Date(zips[0].mtime).toISOString(),
    size: fs.statSync(latest).size,
    path: latest,
  };
}

export function getStorageStats(dataDir: string) {
  const uploadsDir = path.join(dataDir, 'uploads');
  const backupsDir = path.join(dataDir, 'backups');
  const uploadStats = scanDirectoryStats(uploadsDir);
  const backupInfo = getLastBackupInfo(backupsDir);

  return {
    uploadsBytes: uploadStats.bytes,
    uploadsFiles: uploadStats.files,
    uploadsMb: Math.round((uploadStats.bytes / (1024 * 1024)) * 100) / 100,
    dbBytes: getDbSize(dataDir),
    dbMb: Math.round((getDbSize(dataDir) / (1024 * 1024)) * 100) / 100,
    userCount: db.getAllUsersWithStats().length,
    lastBackupAt: backupInfo.at,
    lastBackupSize: backupInfo.size,
  };
}

export function runHealthChecks(dataDir: string) {
  const dbPath = path.join(dataDir, 'biogun.db');
  const uploadsDir = path.join(dataDir, 'uploads');

  const checks = {
    sqlite: false,
    dataDir: false,
    dbFile: false,
    uploadsDir: false,
  };

  try {
    checks.dataDir = fs.existsSync(dataDir);
    const testFile = path.join(dataDir, '.health_write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
  } catch {
    checks.dataDir = false;
  }

  checks.dbFile = fs.existsSync(dbPath);
  checks.uploadsDir = fs.existsSync(uploadsDir);

  try {
    db.db.prepare('SELECT 1').get();
    checks.sqlite = true;
  } catch {
    checks.sqlite = false;
  }

  const uploadStats = scanDirectoryStats(uploadsDir);
  const allOk = Object.values(checks).every(Boolean);
  const anyOk = Object.values(checks).some(Boolean);

  return {
    status: allOk ? 'ok' : anyOk ? 'degraded' : 'error',
    checks,
    stats: {
      uploadsBytes: uploadStats.bytes,
      uploadsFiles: uploadStats.files,
      dbBytes: getDbSize(dataDir),
    },
  };
}

export function isUsingDefaultAdminPassword(dataDir: string): boolean {
  const adminFile = path.join(dataDir, 'admin_password.txt');
  if (fs.existsSync(adminFile)) return false;
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'admin_secret') return false;
  return !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin_secret';
}
