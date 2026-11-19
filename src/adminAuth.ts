import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Пароль админа хранится только в виде scrypt-хэша (data/admin_password.txt, формат `scrypt$salt$hash`).
 * Пароля по умолчанию нет: если ни файла, ни надёжного ADMIN_PASSWORD нет,
 * при старте генерируется случайный пароль, который печатается в лог один раз.
 */

const SCRYPT_PREFIX = 'scrypt$';
const KEYLEN = 64;
const MIN_LENGTH = 8;
const WEAK_PASSWORDS = new Set(['admin_secret', 'admin', 'password', 'changeme', 'your_secure_password']);

export function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyAdminHash(password: string, stored: string): boolean {
  if (!stored.startsWith(SCRYPT_PREFIX)) return false;
  const [saltHex, hashHex] = stored.slice(SCRYPT_PREFIX.length).split('$');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEYLEN) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  return crypto.timingSafeEqual(actual, expected);
}

export function isWeakAdminPassword(password: string | undefined | null): boolean {
  if (!password) return true;
  const p = password.trim();
  return p.length < MIN_LENGTH || WEAK_PASSWORDS.has(p.toLowerCase());
}

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

export interface AdminAuth {
  verify(provided: string): boolean;
  setPassword(newPassword: string): void;
  /** true, если пароль только что сгенерирован и показан в логе */
  readonly generated: boolean;
}

export function createAdminAuth(dataDir: string, env: NodeJS.ProcessEnv = process.env): AdminAuth {
  const file = path.join(dataDir, 'admin_password.txt');
  let storedHash: string | null = null;
  let generated = false;

  const writeHash = (hash: string) => {
    fs.writeFileSync(file, hash, { encoding: 'utf-8', mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch { /* не критично */ }
  };

  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf-8').trim();
      if (raw.startsWith(SCRYPT_PREFIX)) {
        storedHash = raw;
      } else if (!isWeakAdminPassword(raw)) {
        // Миграция старого файла с паролем в открытом виде
        storedHash = hashAdminPassword(raw);
        writeHash(storedHash);
        console.warn('[security] admin_password.txt содержал пароль в открытом виде — переведён в scrypt-хэш.');
      } else {
        console.warn('[security] admin_password.txt содержит слабый/дефолтный пароль — он отброшен.');
      }
    } catch {
      storedHash = null;
    }
  }

  const envPassword = env.ADMIN_PASSWORD;
  const envOk = !isWeakAdminPassword(envPassword);
  if (!storedHash && !envOk) {
    const password = crypto.randomBytes(18).toString('base64url');
    storedHash = hashAdminPassword(password);
    writeHash(storedHash);
    generated = true;
    console.warn('==============================================================');
    console.warn('[security] ADMIN_PASSWORD не задан или слишком слабый.');
    console.warn(`[security] Сгенерирован пароль админ-панели (показывается один раз): ${password}`);
    console.warn('[security] Смените его в админ-панели или задайте ADMIN_PASSWORD в окружении.');
    console.warn('==============================================================');
  }

  return {
    get generated() { return generated; },
    verify(provided: string): boolean {
      if (typeof provided !== 'string' || provided.length === 0 || provided.length > 256) return false;
      if (storedHash) return verifyAdminHash(provided, storedHash);
      // Сравнение хэшей фиксированной длины — не раскрывает длину пароля по времени
      return crypto.timingSafeEqual(sha256(provided), sha256(envPassword as string));
    },
    setPassword(newPassword: string) {
      storedHash = hashAdminPassword(newPassword.trim());
      writeHash(storedHash);
    },
  };
}

/** Счётчик неудачных попыток входа в админку по ключу (IP). */
export class FailureLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private max: number, private windowMs: number) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const e = this.hits.get(key);
    if (!e) return false;
    if (e.resetAt <= now) { this.hits.delete(key); return false; }
    return e.count >= this.max;
  }

  fail(key: string, now = Date.now()) {
    const e = this.hits.get(key);
    if (!e || e.resetAt <= now) this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    else e.count++;
    if (this.hits.size > 10000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
  }

  reset(key: string) { this.hits.delete(key); }
}
