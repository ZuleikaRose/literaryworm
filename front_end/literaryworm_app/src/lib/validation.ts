import type { AppState } from "../store/state";
import { emailKey } from "../store/state";

export const PASSWORD_MIN = 15;
export const PASSWORD_MAX = 64;
export const MIN_ACCOUNT_AGE = 18;

/**
 * A small stand-in for a breached-password list (a real build would check a service such as
 * Have I Been Pwned on the server). Compared case-insensitively.
 */
const breached = new Set([
  "passwordpassword",
  "password1234567",
  "password12345678",
  "123456789012345",
  "1234567890123456",
  "qwertyuiopasdfgh",
  "qwertyuiopasdfghjkl",
  "iloveyouiloveyou",
  "letmeinletmein1",
  "abcdefghijklmnop",
  "aaaaaaaaaaaaaaa",
  "literarywormliteraryworm",
]);

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter an email address like name@example.com.";
  return null;
}

/** NIST SP 800-63B style: length and breach checks, no forced character mix. */
export function validateNewPassword(password: string): string | null {
  if (!password) return "Choose a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. A short phrase works well.`;
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (breached.has(password.toLowerCase())) return "This password has appeared in a data breach. Choose a different one.";
  return null;
}

/** Whole years between `dob` (YYYY-MM-DD) and `today`. */
export function ageOn(dob: string, today = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateDob(dob: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter your date of birth.";
  const age = ageOn(dob);
  if (Number.isNaN(age) || age > 120) return "Check your date of birth.";
  if (age < 0) return "Your date of birth can't be in the future.";
  if (age < MIN_ACCOUNT_AGE)
    return "Account holders must be 18 or older. A parent or guardian can open an account and add a Kids or Teen profile for you.";
  return null;
}

/**
 * True if the email and password match an account known to this session. The caller shows the same
 * message either way, so the page never reveals whether an email is registered.
 */
export function credentialsMatch(state: AppState, email: string, password: string): boolean {
  const household = state.households[emailKey(email)];
  return Boolean(household && household.account.password === password);
}
