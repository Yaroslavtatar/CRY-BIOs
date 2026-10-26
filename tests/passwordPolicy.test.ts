import { describe, it, expect } from 'vitest';
import { validateUserPassword, validateAdminPassword } from '../src/passwordPolicy';

describe('validateUserPassword', () => {
  it('отклоняет пустой и короткий пароль', () => {
    expect(validateUserPassword('').valid).toBe(false);
    expect(validateUserPassword('abc12').valid).toBe(false);
  });

  it('при регистрации требует буквы и цифры', () => {
    expect(validateUserPassword('onlyletters', { isRegistration: true }).valid).toBe(false);
    expect(validateUserPassword('12345678', { isRegistration: true }).valid).toBe(false);
    expect(validateUserPassword('letters123', { isRegistration: true }).valid).toBe(true);
  });

  it('при входе проверяет только длину', () => {
    expect(validateUserPassword('onlyletters').valid).toBe(true);
  });
});

describe('validateAdminPassword', () => {
  it('требует минимум 8 символов без учёта пробелов по краям', () => {
    expect(validateAdminPassword('  short ').valid).toBe(false);
    expect(validateAdminPassword('longenough').valid).toBe(true);
  });
});
