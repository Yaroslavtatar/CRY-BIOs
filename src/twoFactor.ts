/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Двухфакторная аутентификация (TOTP, RFC 6238) без внешних зависимостей.
 * Совместима с Google Authenticator, Authy, 1Password, Aegis и т.п.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const RECOVERY_CODE_COUNT = 10;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-битный секрет (рекомендация RFC 4226) в base32 */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function totpAt(secret: string, timeMs: number = Date.now()): string {
  return hotp(secret, Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS));
}

/**
 * Проверяет код с допуском ±1 шаг (рассинхрон часов).
 * Возвращает номер совпавшего шага или null. Шаг не больше `lastUsedStep` отвергается:
 * один и тот же код нельзя использовать дважды (защита от повторного воспроизведения).
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { now?: number; window?: number; lastUsedStep?: number } = {},
): number | null {
  const digits = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const now = opts.now ?? Date.now();
  const window = opts.window ?? 1;
  const last = opts.lastUsedStep ?? 0;
  const current = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  let matched: number | null = null;
  // Перебираем все окна без раннего выхода, чтобы время ответа не зависело от позиции совпадения
  for (let w = -window; w <= window; w++) {
    const step = current + w;
    const expected = Buffer.from(hotp(secret, step));
    const given = Buffer.from(digits);
    if (crypto.timingSafeEqual(expected, given) && step > last && matched === null) matched = step;
  }
  return matched;
}

export function buildOtpauthUrl(account: string, secret: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- резервные коды ---

export function normalizeRecoveryCode(code: string): string {
  return String(code ?? '').toUpperCase().replace(/[^A-Z2-7]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/** Коды вида ABCDE-FGHJK (50 бит энтропии каждый); в БД хранятся только хэши. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(crypto.randomBytes(7)).slice(0, 10);
    plain.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return { plain, hashes: plain.map(hashRecoveryCode) };
}

/** Проверяет резервный код. При успехе возвращает оставшиеся хэши (использованный удалён). */
export function consumeRecoveryCode(code: string, hashes: string[]): string[] | null {
  const norm = normalizeRecoveryCode(code);
  if (norm.length !== 10) return null;
  const target = Buffer.from(hashRecoveryCode(norm));
  let foundIdx = -1;
  hashes.forEach((h, i) => {
    const hb = Buffer.from(h);
    if (hb.length === target.length && crypto.timingSafeEqual(hb, target) && foundIdx < 0) foundIdx = i;
  });
  if (foundIdx < 0) return null;
  return hashes.filter((_, i) => i !== foundIdx);
}

// --- шифрование секрета в БД (AES-256-GCM) ---

export function loadEncryptionKey(dataDir: string, env: NodeJS.ProcessEnv = process.env): Buffer {
  const fromEnv = env.TWOFA_ENCRYPTION_KEY?.trim();
  if (fromEnv) {
    const buf = /^[0-9a-fA-F]{64}$/.test(fromEnv) ? Buffer.from(fromEnv, 'hex') : Buffer.from(fromEnv, 'base64');
    if (buf.length !== 32) throw new Error('TWOFA_ENCRYPTION_KEY должен содержать 32 байта (64 hex-символа или base64)');
    return buf;
  }
  const keyPath = path.join(dataDir, '2fa.key');
  try {
    const hex = fs.readFileSync(keyPath, 'utf8').trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  } catch { /* создадим ниже */ }
  fs.mkdirSync(dataDir, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Возвращает null, если ключ не подходит или данные повреждены. */
export function decryptSecret(blob: string, key: Buffer): string | null {
  try {
    const [v, iv, tag, ct] = String(blob).split(':');
    if (v !== 'v1' || !iv || !tag || !ct) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// --- короткоживущие «вызовы» между вводом пароля и вводом кода ---

interface Challenge { username: string; expiresAt: number; attempts: number }

export class LoginChallenges {
  private map = new Map<string, Challenge>();
  constructor(private ttlMs = 5 * 60 * 1000, private maxAttempts = 5) {}

  create(username: string): string {
    this.sweep();
    const id = crypto.randomBytes(24).toString('base64url');
    this.map.set(id, { username, expiresAt: Date.now() + this.ttlMs, attempts: 0 });
    return id;
  }

  /** Возвращает имя пользователя, если вызов жив; каждый вызов считается попыткой. */
  attempt(id: string): string | null {
    const c = this.map.get(String(id));
    if (!c || c.expiresAt < Date.now()) { this.map.delete(String(id)); return null; }
    c.attempts += 1;
    if (c.attempts > this.maxAttempts) { this.map.delete(String(id)); return null; }
    return c.username;
  }

  consume(id: string): void { this.map.delete(String(id)); }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.map) if (v.expiresAt < now) this.map.delete(k);
  }
}
