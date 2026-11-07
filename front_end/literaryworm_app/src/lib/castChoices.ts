import { CAST_CHOICES_MAX, type CastChoices, parseCastChoices } from "./naturalVoice";

/**
 * The listener's voices for named speakers, per book (PlayerSettings.castChoices, members'
 * reader_profiles.cast_choices): speaker (lower case) to a CAST_NAMES voice. With none, voices
 * are dealt out (speakerVoice()).
 */

/** The most books a profile keeps choices for; the oldest goes first. */
export const CAST_BOOKS_MAX = 100;

/** All of a profile's choices with one speaker's voice set (null to deal it out again). */
export function withCastChoice(all: Record<string, CastChoices> | undefined, bookId: string, speaker: string, voice: string | null): Record<string, CastChoices> {
  const next = { ...(all ?? {}) };
  const book = { ...(next[bookId] ?? {}) };
  const key = speaker.trim().toLowerCase();
  delete book[key];
  if (voice !== null && Object.keys(book).length < CAST_CHOICES_MAX) book[key] = voice;
  delete next[bookId];
  if (Object.keys(book).length) next[bookId] = parseCastChoices(book);
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - CAST_BOOKS_MAX))) delete next[id];
  return next;
}

/** Choices read back from the database: books with valid choices only. */
export function parseAllCastChoices(value: unknown): Record<string, CastChoices> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, CastChoices> = {};
  for (const [bookId, choices] of Object.entries(value as Record<string, unknown>).slice(-CAST_BOOKS_MAX)) {
    const parsed = parseCastChoices(choices);
    if (bookId.length <= 64 && Object.keys(parsed).length) out[bookId] = parsed;
  }
  return out;
}

/** A short, stable key for a book's choices (so the narrator starts again when they change). */
export const castChoicesKey = (choices: CastChoices) =>
  Object.keys(choices)
    .sort()
    .map((k) => `${k}=${choices[k]}`)
    .join(",");
