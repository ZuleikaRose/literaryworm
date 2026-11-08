/**
 * A profile's monthly share of the household's hours (Account → Family, the profile editor):
 * audiobook listening and natural-voice reading, in minutes. The same lists as manage-profile and
 * migration 6800. Null is no share of its own.
 */
export const LISTENING_SHARES = [60, 120, 180, 300, 600, 900, 1200, 1800] as const;
export const VOICE_SHARES = [30, 60, 120, 180, 300, 600] as const;

/** Seconds of the profile's listening share left this month, or null when it has none. */
export function shareLeft(shareMinutes: number | null | undefined, listenedSeconds: number): number | null {
  if (shareMinutes === null || shareMinutes === undefined) return null;
  return Math.max(0, shareMinutes * 60 - listenedSeconds);
}

/** What's left: the smaller of the household's and the profile's (null for both unlimited), and which one it is. */
export function combinedLeft(household: number | null, profile: number | null): { left: number | null; byShare: boolean } {
  if (profile === null) return { left: household, byShare: false };
  if (household === null || profile <= household) return { left: profile, byShare: true };
  return { left: household, byShare: false };
}
