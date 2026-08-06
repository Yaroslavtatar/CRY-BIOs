export const MIN_USER_PASSWORD_LENGTH = 8;
export const MIN_ADMIN_PASSWORD_LENGTH = 8;

export function validateUserPassword(
  password: string,
  options: { isRegistration?: boolean } = {}
): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Пароль обязателен' };
  }

  if (password.length < MIN_USER_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Пароль должен быть не менее ${MIN_USER_PASSWORD_LENGTH} символов`,
    };
  }

  if (options.isRegistration) {
    if (!/[a-zA-Zа-яА-Я]/.test(password) || !/[0-9]/.test(password)) {
      return { valid: false, error: 'Пароль должен содержать буквы и цифры' };
    }
  }

  return { valid: true };
}

export function validateAdminPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.trim().length < MIN_ADMIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Пароль администратора должен быть не менее ${MIN_ADMIN_PASSWORD_LENGTH} символов`,
    };
  }
  return { valid: true };
}
