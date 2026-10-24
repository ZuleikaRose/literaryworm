import type { AgeRating, Profile } from "../types";

export const PIN_LENGTH = 4;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
export const PROFILE_NAME_MAX = 20;

/** Daily reading and listening limits, in minutes. `null` means no limit. */
export const dailyLimitOptions: { value: number | null; label: string }[] = [
  { value: null, label: "No limit" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1 hour 30 minutes" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
];

export const ageRatingDetails: Record<AgeRating, { label: string; description: string }> = {
  kids: {
    label: "Kids",
    description: "Under 13. Kids titles only, a simpler layout, and no chat, public reviews, sharing or payments.",
  },
  teen: {
    label: "Teen",
    description: "13 to 17. Teen and Kids titles. Reviews show a display name only.",
  },
  all: {
    label: "All",
    description: "Every title in the catalog.",
  },
};

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** Minutes left on a PIN lockout, or 0 if the profile isn't locked. */
export function lockMinutesLeft(profile: Profile, now = Date.now()): number {
  if (!profile.lockedUntil || profile.lockedUntil <= now) return 0;
  return Math.ceil((profile.lockedUntil - now) / 60_000);
}

/** The profile changes that follow a PIN attempt. */
export function pinAttemptResult(profile: Profile, pin: string, now = Date.now()) {
  if (profile.pin === pin) {
    return { ok: true as const, patch: { failedPinAttempts: 0, lockedUntil: null } };
  }
  const failed = profile.failedPinAttempts + 1;
  if (failed >= MAX_PIN_ATTEMPTS) {
    return {
      ok: false as const,
      locked: true,
      attemptsLeft: 0,
      patch: { failedPinAttempts: 0, lockedUntil: now + PIN_LOCK_MINUTES * 60_000 },
    };
  }
  return { ok: false as const, locked: false, attemptsLeft: MAX_PIN_ATTEMPTS - failed, patch: { failedPinAttempts: failed } };
}

export function validateProfileName(name: string, others: Profile[]): string | null {
  const v = name.trim();
  if (!v) return "Enter a name for this profile.";
  if (v.length > PROFILE_NAME_MAX) return `Use ${PROFILE_NAME_MAX} characters or fewer.`;
  if (others.some((p) => p.name.trim().toLowerCase() === v.toLowerCase())) return "Another profile already uses this name.";
  return null;
}
