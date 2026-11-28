import { tr } from "./i18n";
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
  if (!v) return tr("Enter your email address.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return tr("Enter an email address like name@example.com.");
  return null;
}

/**
 * The symbols Supabase Auth counts (its `password_required_characters`, set the same on
 * production and the dev branch): a symbol outside this list, such as a space or £, doesn't count.
 */
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

/** Which of the four kinds Supabase Auth requires the password has (ASCII letters and digits only). */
export function passwordMix(password: string) {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: [...password].some((c) => PASSWORD_SYMBOLS.includes(c)),
  };
}

export function hasPasswordMix(password: string): boolean {
  const mix = passwordMix(password);
  return mix.lower && mix.upper && mix.number && mix.symbol;
}

export type PasswordCheck = "length" | "lower" | "upper" | "number" | "symbol";

/** Each rule a new password must meet, in the order the forms list them, and whether it's met yet. */
export function passwordChecks(password: string): { id: PasswordCheck; ok: boolean }[] {
  const mix = passwordMix(password);
  return [
    { id: "length", ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: "lower", ok: mix.lower },
    { id: "upper", ok: mix.upper },
    { id: "number", ok: mix.number },
    { id: "symbol", ok: mix.symbol },
  ];
}

/**
 * The same rules as Supabase Auth: 15 to 64 characters, a lowercase letter, a capital, a number
 * and a symbol, and not a known breached password (Auth also checks Have I Been Pwned).
 */
export function validateNewPassword(password: string): string | null {
  if (!password) return tr("Choose a password.");
  if (password.length < PASSWORD_MIN) return tr("Use at least {n} characters. A short phrase works well.", { n: PASSWORD_MIN });
  if (password.length > PASSWORD_MAX) return tr("Use {n} characters or fewer.", { n: PASSWORD_MAX });
  if (!hasPasswordMix(password))
    return tr("Use at least one lowercase letter, one capital, one number and one symbol such as ! ? # or %.");
  if (breached.has(password.toLowerCase())) return tr("This password has appeared in a data breach. Choose a different one.");
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return tr("Enter your date of birth.");
  const age = ageOn(dob);
  if (Number.isNaN(age) || age > 120) return tr("Check your date of birth.");
  if (age < 0) return tr("Your date of birth can't be in the future.");
  if (age < MIN_ACCOUNT_AGE)
    return tr("Account holders must be 18 or older. A parent or guardian can open an account and add a Kids or Teen profile for you.");
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
