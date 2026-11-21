import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  LoginChallenges,
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  consumeRecoveryCode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  loadEncryptionKey,
  totpAt,
  verifyTotp,
} from '../src/twoFactor';

// Секрет из RFC 6238 (ASCII "12345678901234567890"), SHA-1, 6 цифр
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('base32 кодирует и декодирует без потерь', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(RFC_SECRET).toString()).toBe('12345678901234567890');
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it('совпадает с тестовыми векторами RFC 6238', () => {
    const vectors: [number, string][] = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ];
    for (const [t, code] of vectors) expect(totpAt(RFC_SECRET, t * 1000)).toBe(code);
  });

  it('допускает ±1 шаг, но не больше', () => {
    const now = 1_700_000_000_000;
    const at = (shiftSteps: number) => totpAt(RFC_SECRET, now + shiftSteps * 30_000);
    expect(verifyTotp(RFC_SECRET, at(0), { now })).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, at(-1), { now })).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, at(1), { now })).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, at(3), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, at(-3), { now })).toBeNull();
  });

  it('отвергает повторное использование кода (replay)', () => {
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, now);
    const step = verifyTotp(RFC_SECRET, code, { now });
    expect(step).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step! })).toBeNull();
  });

  it('отвергает мусор вместо кода', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5x', null as any, undefined as any]) {
      expect(verifyTotp(RFC_SECRET, bad)).toBeNull();
    }
  });

  it('принимает код с пробелом посередине (как показывают приложения)', () => {
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).not.toBeNull();
  });

  it('otpauth-ссылка содержит секрет и издателя', () => {
    const url = buildOtpauthUrl('bob', 'ABC234', 'CRY BIOS');
    expect(url.startsWith('otpauth://totp/CRY%20BIOS%3Abob?')).toBe(true);
    expect(url).toContain('secret=ABC234');
    expect(url).toContain('issuer=CRY+BIOS');
  });
});

describe('резервные коды', () => {
  it('генерирует 10 уникальных кодов, хранит только хэши', () => {
    const { plain, hashes } = generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);
    plain.forEach((c) => expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/));
    hashes.forEach((h) => expect(h).toMatch(/^[0-9a-f]{64}$/));
    expect(JSON.stringify(hashes)).not.toContain(plain[0].replace('-', ''));
  });

  it('код работает один раз, регистр и дефис не важны', () => {
    const { plain, hashes } = generateRecoveryCodes();
    const rest = consumeRecoveryCode(plain[3].toLowerCase().replace('-', ' '), hashes);
    expect(rest).not.toBeNull();
    expect(rest).toHaveLength(9);
    expect(consumeRecoveryCode(plain[3], rest!)).toBeNull();
    expect(consumeRecoveryCode(plain[4], rest!)).toHaveLength(8);
  });

  it('чужой или короткий код отвергается', () => {
    const { hashes } = generateRecoveryCodes();
    expect(consumeRecoveryCode('AAAAA-AAAAA', hashes)).toBeNull();
    expect(consumeRecoveryCode('123456', hashes)).toBeNull();
    expect(consumeRecoveryCode('', hashes)).toBeNull();
  });
});

describe('шифрование секрета', () => {
  const key = Buffer.alloc(32, 7);

  it('шифрует и расшифровывает', () => {
    const blob = encryptSecret('JBSWY3DPEHPK3PXP', key);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(blob, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('с другим ключом или повреждённым текстом возвращает null', () => {
    const blob = encryptSecret('JBSWY3DPEHPK3PXP', key);
    expect(decryptSecret(blob, Buffer.alloc(32, 9))).toBeNull();
    expect(decryptSecret(blob.slice(0, -4) + 'AAAA', key)).toBeNull();
    expect(decryptSecret('garbage', key)).toBeNull();
  });

  it('ключ берётся из окружения, иначе создаётся файл 2fa.key и переиспользуется', () => {
    const hex = 'ab'.repeat(32);
    expect(loadEncryptionKey('/nonexistent', { TWOFA_ENCRYPTION_KEY: hex } as any).toString('hex')).toBe(hex);
    expect(() => loadEncryptionKey('/nonexistent', { TWOFA_ENCRYPTION_KEY: 'short' } as any)).toThrow();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), '2fa-'));
    const k1 = loadEncryptionKey(dir, {} as any);
    const k2 = loadEncryptionKey(dir, {} as any);
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
    if (process.platform !== 'win32') expect(fs.statSync(path.join(dir, '2fa.key')).mode & 0o077).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('вызов второго шага входа', () => {
  it('живёт ограниченное число попыток', () => {
    const c = new LoginChallenges(60_000, 3);
    const id = c.create('bob');
    expect(c.attempt(id)).toBe('bob');
    expect(c.attempt(id)).toBe('bob');
    expect(c.attempt(id)).toBe('bob');
    expect(c.attempt(id)).toBeNull();
    expect(c.attempt(id)).toBeNull();
  });

  it('одноразовый после успеха и не принимает выдуманные значения', () => {
    const c = new LoginChallenges();
    const id = c.create('bob');
    c.consume(id);
    expect(c.attempt(id)).toBeNull();
    expect(c.attempt('nope')).toBeNull();
  });

  it('истекает по времени', () => {
    const c = new LoginChallenges(-1);
    expect(c.attempt(c.create('bob'))).toBeNull();
  });
});
