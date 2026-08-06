import * as db from './db';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isAccountLocked(user: { locked_until?: string | null } | null | undefined): boolean {
  if (!user?.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

export function recordFailedLogin(username: string): void {
  db.incrementFailedLogin(username, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES);
}

export function clearLoginAttempts(username: string): void {
  db.clearFailedLogin(username);
}
