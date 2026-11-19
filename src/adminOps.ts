import fs from 'fs';
import path from 'path';
import os from 'os';
import { sanitizeHomeLayout, getDefaultHomeLayout, type HomeLayout } from './homeLayout';

/* ---------- макет главной ---------- */

function layoutPath(dataDir: string) {
  return path.join(dataDir, 'home_layout.json');
}

export function readHomeLayout(dataDir: string): HomeLayout {
  try {
    const p = layoutPath(dataDir);
    if (!fs.existsSync(p)) return getDefaultHomeLayout();
    return sanitizeHomeLayout(JSON.parse(fs.readFileSync(p, 'utf-8')));
  } catch {
    return getDefaultHomeLayout();
  }
}

export function writeHomeLayout(dataDir: string, input: unknown): HomeLayout {
  const clean = sanitizeHomeLayout(input);
  clean.updatedAt = new Date().toISOString();
  const p = layoutPath(dataDir);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
  return clean;
}

export function resetHomeLayout(dataDir: string): HomeLayout {
  fs.rmSync(layoutPath(dataDir), { force: true });
  return getDefaultHomeLayout();
}

/* ---------- журнал действий администратора ---------- */

export interface AuditEntry {
  ts: string;
  ip: string;
  action: string;
  detail?: string;
}

const AUDIT_MAX_BYTES = 1024 * 1024;

function auditPath(dataDir: string) {
  return path.join(dataDir, 'admin_audit.log');
}

export function writeAudit(dataDir: string, entry: Omit<AuditEntry, 'ts'>) {
  try {
    const p = auditPath(dataDir);
    if (fs.existsSync(p) && fs.statSync(p).size > AUDIT_MAX_BYTES) {
      fs.renameSync(p, `${p}.1`);
    }
    const line: AuditEntry = { ts: new Date().toISOString(), ...entry, detail: entry.detail?.slice(0, 300) };
    fs.appendFileSync(p, JSON.stringify(line) + '\n', 'utf-8');
  } catch {
    /* журнал не должен ронять запрос */
  }
}

export function readAudit(dataDir: string, limit = 100): AuditEntry[] {
  try {
    const p = auditPath(dataDir);
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => {
        try {
          return JSON.parse(l) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEntry => e !== null);
  } catch {
    return [];
  }
}

/* ---------- кольцевой буфер серверных логов ---------- */

export interface LogEntry {
  ts: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}

const LOG_MAX = 500;
const logBuffer: LogEntry[] = [];
let captureInstalled = false;

export function installLogCapture() {
  if (captureInstalled) return;
  captureInstalled = true;
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const message = args
          .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.stack || a.message : JSON.stringify(a)))
          .join(' ')
          .slice(0, 1000);
        logBuffer.push({ ts: new Date().toISOString(), level, message });
        if (logBuffer.length > LOG_MAX) logBuffer.splice(0, logBuffer.length - LOG_MAX);
      } catch {
        /* ignore */
      }
      original(...args);
    };
  }
}

export function readLogs(opts: { level?: string; limit?: number } = {}): LogEntry[] {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  const filtered = opts.level && opts.level !== 'all' ? logBuffer.filter((l) => l.level === opts.level) : logBuffer;
  return filtered.slice(-limit).reverse();
}

export function clearLogs() {
  logBuffer.length = 0;
}

/* ---------- системная информация ---------- */

export function getSystemInfo(dataDir: string) {
  const mem = process.memoryUsage();
  let disk: { totalGb: number; freeGb: number } | null = null;
  try {
    const s = fs.statfsSync(dataDir);
    disk = {
      totalGb: Math.round(((s.blocks * s.bsize) / 1024 ** 3) * 10) / 10,
      freeGb: Math.round(((s.bavail * s.bsize) / 1024 ** 3) * 10) / 10,
    };
  } catch {
    disk = null;
  }
  return {
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    env: process.env.NODE_ENV || 'development',
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    cpuCount: os.cpus().length,
    systemTotalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    systemFreeMemMb: Math.round(os.freemem() / 1024 / 1024),
    disk,
  };
}
