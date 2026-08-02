import fs from 'fs';
import path from 'path';
import { BioConfig } from './types';

const UPLOAD_PREFIX = '/uploads/';

function extractUploadPath(value: string | undefined | null, out: Set<string>) {
  if (!value || typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed.startsWith(UPLOAD_PREFIX)) {
    out.add(trimmed.split('?')[0]);
  }
}

export function collectUsedUploadPaths(configs: BioConfig[]): Set<string> {
  const used = new Set<string>();

  for (const config of configs) {
    extractUploadPath(config.avatarUrl, used);
    extractUploadPath(config.bgValue, used);
    extractUploadPath(config.audioUrl, used);
    extractUploadPath(config.customCursorUrl, used);
    extractUploadPath(config.customFaviconUrl, used);

    if (config.playlist) {
      for (const song of config.playlist) {
        extractUploadPath(song.url, used);
      }
    }

    if (config.blocks) {
      for (const block of config.blocks) {
        extractUploadPath(block.imageUrl, used);
      }
    }
  }

  // Map main uploads to thumbs
  const withThumbs = new Set(used);
  for (const p of used) {
    if (p.startsWith('/uploads/') && !p.includes('/thumbs/')) {
      const base = path.basename(p, path.extname(p));
      withThumbs.add(`/uploads/thumbs/${base}.webp`);
    }
  }

  return withThumbs;
}

function resolveSafeUploadPath(uploadsDir: string, relativePath: string): string | null {
  const normalized = relativePath.replace(/^\/uploads\//, '');
  const full = path.resolve(uploadsDir, normalized);
  const uploadsRoot = path.resolve(uploadsDir);
  if (!full.startsWith(uploadsRoot + path.sep) && full !== uploadsRoot) {
    return null;
  }
  return full;
}

function walkUploadFiles(uploadsDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(uploadsDir)) return files;

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  };
  walk(uploadsDir);
  return files;
}

export function scanOrphanFiles(uploadsDir: string, used: Set<string>): string[] {
  const usedAbs = new Set<string>();
  for (const p of used) {
    const abs = resolveSafeUploadPath(uploadsDir, p);
    if (abs) usedAbs.add(abs);
  }

  return walkUploadFiles(uploadsDir).filter(f => !usedAbs.has(f));
}

export function deleteOrphanFiles(paths: string[]): { deleted: number; bytesFreed: number } {
  let deleted = 0;
  let bytesFreed = 0;

  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        deleted += 1;
        bytesFreed += stat.size;
      }
    } catch (err) {
      console.warn(`[cleanup] Failed to delete ${filePath}:`, err);
    }
  }

  return { deleted, bytesFreed };
}

export function deleteUnusedBetweenConfigs(
  oldConfig: BioConfig | null,
  newConfig: BioConfig,
  allConfigs: BioConfig[],
  uploadsDir: string
): { deleted: number; bytesFreed: number } {
  if (!oldConfig) return { deleted: 0, bytesFreed: 0 };

  const allUsed = collectUsedUploadPaths(allConfigs);
  const oldPaths = collectUsedUploadPaths([oldConfig]);

  const candidates: string[] = [];
  for (const p of oldPaths) {
    if (!allUsed.has(p)) {
      const abs = resolveSafeUploadPath(uploadsDir, p);
      if (abs) candidates.push(abs);
    }
  }

  return deleteOrphanFiles(candidates);
}

export function cleanupAllOrphans(uploadsDir: string, allConfigs: BioConfig[]) {
  const used = collectUsedUploadPaths(allConfigs);
  const orphans = scanOrphanFiles(uploadsDir, used);
  return deleteOrphanFiles(orphans);
}
