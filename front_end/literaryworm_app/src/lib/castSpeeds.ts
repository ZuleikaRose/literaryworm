/**
 * A speed for each named speaker in a book (Who reads whom, Player settings): the player plays that
 * speaker's parts at the player's speed times this, so a character can talk a little faster or
 * slower. Nothing is voiced again: each speech is already its own part (chapterPieces() with
 * character voices). Per profile and book (PlayerSettings.castSpeeds, members'
 * reader_profiles.cast_speeds); speaker names in lower case, as castChoices keeps them.
 */
export const CAST_SPEEDS = [0.8, 0.9, 1.1, 1.2] as const;
/** The most speakers a book keeps speeds for, and the most books (the oldest goes first). */
export const CAST_SPEEDS_MAX = 40;
export const CAST_SPEED_BOOKS_MAX = 100;

export type CastSpeeds = Record<string, number>;

const valid = (v: unknown): v is number => typeof v === "number" && (CAST_SPEEDS as readonly number[]).includes(v);

/** All of a profile's speeds with one speaker's set (null, or 1, for the player's own speed). */
export function withCastSpeed(all: Record<string, CastSpeeds> | undefined, bookId: string, speaker: string, speed: number | null): Record<string, CastSpeeds> {
  const next = { ...(all ?? {}) };
  const book = { ...(next[bookId] ?? {}) };
  const key = speaker.trim().toLowerCase();
  delete book[key];
  if (speed !== null && valid(speed) && Object.keys(book).length < CAST_SPEEDS_MAX) book[key] = speed;
  delete next[bookId];
  if (Object.keys(book).length) next[bookId] = book;
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - CAST_SPEED_BOOKS_MAX))) delete next[id];
  return next;
}

/** Speeds read back from the database: known speeds only, within the limits. */
export function parseAllCastSpeeds(value: unknown): Record<string, CastSpeeds> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, CastSpeeds> = {};
  for (const [bookId, speeds] of Object.entries(value as Record<string, unknown>).slice(-CAST_SPEED_BOOKS_MAX)) {
    if (bookId.length > 64 || !speeds || typeof speeds !== "object" || Array.isArray(speeds)) continue;
    const book: CastSpeeds = {};
    for (const [speaker, speed] of Object.entries(speeds as Record<string, unknown>).slice(0, CAST_SPEEDS_MAX)) {
      if (speaker.length > 0 && speaker.length <= 60 && valid(speed)) book[speaker] = speed;
    }
    if (Object.keys(book).length) out[bookId] = book;
  }
  return out;
}

/** The speed a part plays at, as a share of the player's: its speaker's, else 1. */
export function speakerRate(speeds: CastSpeeds | undefined, speaker: string | null | undefined): number {
  return (speaker && speeds?.[speaker.toLowerCase()]) || 1;
}
