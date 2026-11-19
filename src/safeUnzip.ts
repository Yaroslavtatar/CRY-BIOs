import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { pipeline } from 'stream/promises';

export interface SafeUnzipLimits {
  maxEntries: number;
  maxTotalBytes: number;
  maxEntryBytes: number;
}

const DEFAULT_LIMITS: SafeUnzipLimits = {
  maxEntries: 50_000,
  maxTotalBytes: 8 * 1024 * 1024 * 1024,
  maxEntryBytes: 1024 * 1024 * 1024,
};

/**
 * Безопасная распаковка ZIP: отвергает symlink'и, абсолютные пути, `..`, дубликаты,
 * пишет файлы с флагом `wx` и ограничивает число записей и суммарный размер (zip-бомба).
 */
export function safeExtractZip(zipPath: string, destDir: string, limits: Partial<SafeUnzipLimits> = {}): Promise<void> {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  const root = path.resolve(destDir);
  fs.mkdirSync(root, { recursive: true });

  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Cannot open zip'));

      const seen = new Set<string>();
      let entries = 0;
      let total = 0;
      let done = false;
      const fail = (e: Error) => {
        if (done) return;
        done = true;
        zipfile.close();
        reject(e);
      };

      zipfile.on('error', fail);
      zipfile.on('end', () => {
        if (done) return;
        done = true;
        resolve();
      });

      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (done) return;
        entries++;
        if (entries > lim.maxEntries) return fail(new Error('Zip has too many entries'));

        const name = entry.fileName;
        if (name.includes('\0') || name.includes('\\') || path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) {
          return fail(new Error(`Unsafe zip entry: ${name}`));
        }
        const segments = name.split('/');
        if (segments.some(s => s === '..')) return fail(new Error(`Unsafe zip entry: ${name}`));

        // Unix-тип файла в верхних 16 битах external attributes: symlink = 0o120000
        const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (mode === 0o120000) return fail(new Error(`Symlink in zip rejected: ${name}`));
        if (mode !== 0 && mode !== 0o100000 && mode !== 0o040000) return fail(new Error(`Special file in zip rejected: ${name}`));

        const target = path.resolve(root, name);
        if (target !== root && !target.startsWith(root + path.sep)) {
          return fail(new Error(`Unsafe zip entry: ${name}`));
        }

        const key = target.toLowerCase();
        if (seen.has(key)) return fail(new Error(`Duplicate zip entry: ${name}`));
        seen.add(key);

        const isDir = name.endsWith('/');
        if (isDir) {
          fs.mkdirSync(target, { recursive: true });
          return zipfile.readEntry();
        }

        if (entry.uncompressedSize > lim.maxEntryBytes) return fail(new Error(`Zip entry too large: ${name}`));
        total += entry.uncompressedSize;
        if (total > lim.maxTotalBytes) return fail(new Error('Zip uncompressed size exceeds limit'));

        // Родительский каталог не должен оказаться symlink'ом
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const realParent = fs.realpathSync(path.dirname(target));
        const realRoot = fs.realpathSync(root);
        if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) {
          return fail(new Error(`Unsafe zip entry: ${name}`));
        }

        zipfile.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return fail(e2 || new Error('Cannot read zip entry'));
          let written = 0;
          stream.on('data', (chunk: Buffer) => {
            written += chunk.length;
            if (written > lim.maxEntryBytes) stream.destroy(new Error(`Zip entry too large: ${name}`));
          });
          pipeline(stream, fs.createWriteStream(target, { flags: 'wx', mode: 0o644 }))
            .then(() => zipfile.readEntry())
            .catch(fail);
        });
      });

      zipfile.readEntry();
    });
  });
}
