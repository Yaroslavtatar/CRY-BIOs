import fs from 'fs';
import path from 'path';
import { writeBackupToFile } from './backup';

const DEFAULT_RETAIN = 5;
const DEFAULT_HOURS = 24;

export function startScheduledBackups(options: {
  dataDir: string;
  uploadsDir: string;
  includeAnalytics?: boolean;
}) {
  const retain = parseInt(process.env.BACKUP_RETAIN || String(DEFAULT_RETAIN), 10);
  const hours = parseFloat(process.env.BACKUP_CRON_HOURS || String(DEFAULT_HOURS));
  const intervalMs = Math.max(hours, 1) * 60 * 60 * 1000;

  const backupsDir = path.join(options.dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const run = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const outPath = path.join(backupsDir, `backup-${date}.zip`);
      const result = await writeBackupToFile(outPath, {
        includeAnalytics: options.includeAnalytics !== false,
        uploadsDir: options.uploadsDir,
        dataDir: options.dataDir,
      });

      fs.writeFileSync(
        path.join(backupsDir, 'last-backup.json'),
        JSON.stringify({ at: new Date().toISOString(), size: result.size, path: outPath }, null, 2)
      );

      rotateBackups(backupsDir, retain);
      console.log(`[backup] Scheduled backup written: ${outPath} (${result.size} bytes)`);
    } catch (err) {
      console.error('[backup] Scheduled backup failed:', err);
    }
  };

  // Initial delay 5 min after boot, then interval
  setTimeout(() => {
    run();
    setInterval(run, intervalMs);
  }, 5 * 60 * 1000);

  console.log(`[backup] Scheduler started: every ${hours}h, retain ${retain}`);
}

function rotateBackups(backupsDir: string, retain: number) {
  const zips = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of zips.slice(retain)) {
    try {
      fs.unlinkSync(path.join(backupsDir, old.name));
    } catch { /* ignore */ }
  }
}
