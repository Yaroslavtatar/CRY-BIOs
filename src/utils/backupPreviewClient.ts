import { unzip } from 'fflate';

export type BackupPreview = {
  version?: number;
  exportedAt?: string;
  userCount?: number;
  uploadCount?: number;
  includeAnalytics?: boolean;
};

const MAX_CLIENT_PREVIEW_BYTES = 500 * 1024 * 1024;

function decodeEntry(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data);
}

/** Preview CRY BIOS backup zip locally — no server upload (avoids 502 on large archives). */
export async function previewBackupZipClient(file: File): Promise<BackupPreview> {
  if (file.size > MAX_CLIENT_PREVIEW_BYTES) {
    throw new Error('Backup file exceeds maximum allowed size (500 MB)');
  }

  const isZip =
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';
  if (!isZip) {
    throw new Error('Only ZIP backup files are supported');
  }

  const buffer = await file.arrayBuffer();
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  let uploadCount = 0;
  for (const name of Object.keys(entries)) {
    const normalized = name.replace(/\\/g, '/');
    if (!normalized.endsWith('/') && normalized.startsWith('uploads/')) {
      uploadCount += 1;
    }
  }

  const metaKey = Object.keys(entries).find((k) => {
    const n = k.replace(/\\/g, '/');
    return n === 'meta.json' || n.endsWith('/meta.json');
  });

  if (metaKey) {
    try {
      const meta = JSON.parse(decodeEntry(entries[metaKey])) as BackupPreview;
      if (meta.uploadCount == null && uploadCount > 0) {
        meta.uploadCount = uploadCount;
      }
      return meta;
    } catch {
      throw new Error('Invalid backup: meta.json is malformed');
    }
  }

  const dumpKey = Object.keys(entries).find((k) => {
    const n = k.replace(/\\/g, '/');
    return n === 'dump.json' || n.endsWith('/dump.json');
  });

  if (dumpKey) {
    try {
      const dump = JSON.parse(decodeEntry(entries[dumpKey]));
      return {
        version: 1,
        userCount: dump.users?.length ?? 0,
        uploadCount: uploadCount || undefined,
      };
    } catch {
      throw new Error('Invalid backup: dump.json is malformed');
    }
  }

  throw new Error('Invalid backup: meta.json not found');
}
