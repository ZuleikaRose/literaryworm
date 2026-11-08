import { CHARACTERS_PER_HOUR } from "./naturalVoice";

/**
 * Club listening hours (book_clubs.voice_minutes_per_member, migration 6807; components/ClubVoiceHours.tsx):
 * the owner of a club reading an uploaded book gives each member up to so many minutes a month of
 * natural-voice reading for their own copy, from the owner's own month, used only after the
 * member's own hours run out (the natural-voice function decides; club_voice_source()).
 * The database checks the same choices.
 */
export const CLUB_VOICE_MINUTES = [30, 60, 120, 180] as const;

export type ClubVoiceMinutes = (typeof CLUB_VOICE_MINUTES)[number];

export const isClubVoiceMinutes = (value: unknown): value is ClubVoiceMinutes =>
  (CLUB_VOICE_MINUTES as readonly unknown[]).includes(value);

/** Characters of natural-voice reading in a minute (CHARACTERS_PER_HOUR / 60), as the database counts. */
export const CHARACTERS_PER_MINUTE = CHARACTERS_PER_HOUR / 60;

/** Whole minutes of a club's gift used, and left, this month; null when the club gives none. */
export function clubVoiceLeft(minutes: number | null | undefined, usedCharacters: number): { used: number; left: number } | null {
  if (!minutes || minutes <= 0) return null;
  const used = Math.min(minutes, Math.round(Math.max(0, usedCharacters) / CHARACTERS_PER_MINUTE));
  return { used, left: minutes - used };
}
