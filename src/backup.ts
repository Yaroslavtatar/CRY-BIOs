import { ZipArchive } from 'archiver';
import type { Archiver } from 'archiver';
import extract from 'extract-zip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Response } from 'express';
import * as db from './db';
import { BioConfig } from './types';
import { collectUsedUploadPaths } from './uploadCleanup';

export const BACKUP_VERSION = 1;
const MAX_BACKUP_SIZE = 500 * 1024 * 1024;

export function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count += 1;
    }
  }
  return count;
}

function addDirectoryToArchive(archive: Archiver, dir: string, archivePath: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const entryArchivePath = path.join(archivePath, entry.name);
    if (entry.isDirectory()) {
      addDirectoryToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath.replace(/\\/g, '/') });
    }
  }
}

function addFilesToArchive(archive: Archiver, uploadsDir: string, paths: Set<string>) {
  for (const rel of paths) {
    const normalized = rel.replace(/^\/uploads\//, '');
    const full = path.join(uploadsDir, normalized);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      archive.file(full, { name: `uploads/${normalized}`.replace(/\\/g, '/') });
    }
  }
}

function clearDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

function buildMeta(dump: ReturnType<typeof db.exportDatabase>, uploadsDir: string, includeAnalytics: boolean) {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userCount: dump.users.length,
    uploadCount: countFiles(uploadsDir),
    includeAnalytics,
  };
}

export function streamFullBackup(
  res: Response,
  options: { includeAnalytics: boolean; uploadsDir: string; dataDir: string }
) {
  const dump = db.exportDatabase({ includeAnalytics: options.includeAnalytics });
  const meta = buildMeta(dump, options.uploadsDir, options.includeAnalytics);

  const filename = `cry_bios_backup_${Date.now()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  archive.pipe(res);
  archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
  archive.append(JSON.stringify(dump, null, 2), { name: 'dump.json' });
  addDirectoryToArchive(archive, options.uploadsDir, 'uploads');

  if (fs.existsSync(path.join(options.dataDir, 'admin_password.txt'))) {
    archive.file(path.join(options.dataDir, 'admin_password.txt'), { name: 'admin_password.txt' });
  }
  if (fs.existsSync(path.join(options.dataDir, 'site_settings.json'))) {
    archive.file(path.join(options.dataDir, 'site_settings.json'), { name: 'site_settings.json' });
  }

  return archive.finalize();
}

export function writeBackupToFile(
  outPath: string,
  options: { includeAnalytics: boolean; uploadsDir: string; dataDir: string }
): Promise<{ size: number }> {
  return new Promise((resolve, reject) => {
    const dump = db.exportDatabase({ includeAnalytics: options.includeAnalytics });
    const meta = buildMeta(dump, options.uploadsDir, options.includeAnalytics);

    const output = fs.createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    archive.on('error', reject);
    output.on('error', reject);
    output.on('close', () => {
      resolve({ size: fs.statSync(outPath).size });
    });

    archive.pipe(output);
    archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
    archive.append(JSON.stringify(dump, null, 2), { name: 'dump.json' });
    addDirectoryToArchive(archive, options.uploadsDir, 'uploads');

    if (fs.existsSync(path.join(options.dataDir, 'admin_password.txt'))) {
      archive.file(path.join(options.dataDir, 'admin_password.txt'), { name: 'admin_password.txt' });
    }

    archive.finalize();
  });
}

export async function previewBackupZip(zipPath: string): Promise<{
  version?: number;
  exportedAt?: string;
  userCount?: number;
  uploadCount?: number;
  includeAnalytics?: boolean;
}> {
  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_BACKUP_SIZE) {
    throw new Error('Backup file exceeds maximum allowed size (500 MB)');
  }

  const tmpDir = path.join(path.dirname(zipPath), `preview_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await extract(zipPath, { dir: tmpDir });

    const metaPath = path.join(tmpDir, 'meta.json');
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    const dumpPath = path.join(tmpDir, 'dump.json');
    if (fs.existsSync(dumpPath)) {
      const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
      return {
        version: BACKUP_VERSION,
        userCount: dump.users?.length ?? 0,
        uploadCount: undefined,
      };
    }

    throw new Error('Invalid backup: meta.json not found');
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

export async function importFullBackup(
  zipPath: string,
  options: { uploadsDir: string; dataDir: string }
): Promise<{ userCount: number; uploadCount: number }> {
  const stat = fs.statSync(zipPath);
  if (stat.size > MAX_BACKUP_SIZE) {
    throw new Error('Backup file exceeds maximum allowed size (500 MB)');
  }

  const tmpDir = path.join(options.dataDir, 'tmp_restore');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await extract(zipPath, { dir: tmpDir });

    const metaPath = path.join(tmpDir, 'meta.json');
    const dumpPath = path.join(tmpDir, 'dump.json');
    if (!fs.existsSync(dumpPath)) {
      throw new Error('Invalid backup: dump.json not found');
    }

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.version && meta.version > BACKUP_VERSION) {
        throw new Error(`Unsupported backup version: ${meta.version}`);
      }
    }

    const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
    if (!dump || typeof dump !== 'object') {
      throw new Error('Invalid backup: malformed dump.json');
    }

    const extractedUploads = path.join(tmpDir, 'uploads');
    clearDirectory(options.uploadsDir);
    if (fs.existsSync(extractedUploads)) {
      for (const entry of fs.readdirSync(extractedUploads, { withFileTypes: true })) {
        const src = path.join(extractedUploads, entry.name);
        const dest = path.join(options.uploadsDir, entry.name);
        if (entry.isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    const adminPasswordSrc = path.join(tmpDir, 'admin_password.txt');
    if (fs.existsSync(adminPasswordSrc)) {
      fs.copyFileSync(adminPasswordSrc, path.join(options.dataDir, 'admin_password.txt'));
    }

    const siteSettingsSrc = path.join(tmpDir, 'site_settings.json');
    if (fs.existsSync(siteSettingsSrc)) {
      fs.copyFileSync(siteSettingsSrc, path.join(options.dataDir, 'site_settings.json'));
    }

    db.importDatabase(dump);

    return {
      userCount: dump.users?.length ?? 0,
      uploadCount: countFiles(options.uploadsDir),
    };
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

export function streamUserBackup(
  res: Response,
  username: string,
  options: { uploadsDir: string }
) {
  const bio = db.getBio(username);
  const user = db.getUser(username);
  if (!bio || !user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const paths = collectUsedUploadPaths([bio]);
  const meta = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    username,
    uploadCount: paths.size,
  };

  const filename = `cry_bios_user_${username}_${Date.now()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  archive.pipe(res);
  archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
  archive.append(JSON.stringify({
    user: { username: user.username, password_hash: user.password_hash, token: user.token },
    bio,
  }, null, 2), { name: 'user.json' });
  addFilesToArchive(archive, options.uploadsDir, paths);
  return archive.finalize();
}

export async function importUserBackup(
  zipPath: string,
  targetUsername: string,
  options: { uploadsDir: string; overwrite?: boolean }
): Promise<{ username: string }> {
  const tmpDir = path.join(path.dirname(zipPath), `user_restore_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await extract(zipPath, { dir: tmpDir });

    const userJsonPath = path.join(tmpDir, 'user.json');
    if (!fs.existsSync(userJsonPath)) {
      throw new Error('Invalid user backup: user.json not found');
    }

    const payload = JSON.parse(fs.readFileSync(userJsonPath, 'utf-8'));
    const bio = payload.bio as BioConfig;
    const userRow = payload.user;

    if (!bio || !userRow) {
      throw new Error('Invalid user backup: malformed user.json');
    }

    const normUsername = targetUsername.toLowerCase();
    const existing = db.getUser(normUsername);

    if (existing && !options.overwrite) {
      throw new Error('User already exists. Set overwrite=true to replace.');
    }

    bio.username = normUsername;

    const extractedUploads = path.join(tmpDir, 'uploads');
    if (fs.existsSync(extractedUploads)) {
      for (const entry of fs.readdirSync(extractedUploads, { withFileTypes: true })) {
        const src = path.join(extractedUploads, entry.name);
        const dest = path.join(options.uploadsDir, entry.name);
        if (entry.isDirectory()) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          for (const sub of fs.readdirSync(src, { withFileTypes: true })) {
            const subSrc = path.join(src, sub.name);
            const subDest = path.join(dest, sub.name);
            if (sub.isDirectory()) {
              fs.cpSync(subSrc, subDest, { recursive: true });
            } else if (!fs.existsSync(subDest)) {
              fs.copyFileSync(subSrc, subDest);
            }
          }
        } else if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    if (existing) {
      if (userRow.password_hash) {
        db.updateUserPassword(normUsername, userRow.password_hash);
      }
      if (userRow.token) {
        db.updateUserToken(normUsername, userRow.token);
      }
    } else {
      if (!userRow.password_hash) {
        throw new Error('Invalid user backup: missing password_hash for new user');
      }
      db.createUser(normUsername, userRow.password_hash, userRow.token || crypto.randomUUID());
    }

    db.saveBio(normUsername, bio);
    return { username: normUsername };
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
