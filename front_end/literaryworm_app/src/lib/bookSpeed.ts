import type { PlayerSettings } from "../types";

/**
 * A listening speed kept for one book (PlayerSettings.bookSpeeds, members' reader_profiles.book_speeds):
 * a book with its own speed plays at it, every other book at the profile's speed. Changing the
 * speed while such a book is open changes that book's speed only.
 */

/** The most books a profile keeps a speed for; the oldest goes when a new one would pass it. */
export const BOOK_SPEEDS_MAX = 200;

/** Speeds the player offers (and the database allows). */
const SPEED_MIN = 0.5;
const SPEED_MAX = 3;

export function speedFor(player: PlayerSettings, bookId: string | null | undefined): number {
  const own = bookId ? player.bookSpeeds?.[bookId] : undefined;
  return own ?? player.speed;
}

export function hasOwnSpeed(player: PlayerSettings, bookId: string | null | undefined): boolean {
  return Boolean(bookId && player.bookSpeeds && Object.hasOwn(player.bookSpeeds, bookId));
}

/** bookSpeeds with a book's speed set (null to forget it), the newest last, at most BOOK_SPEEDS_MAX. */
export function withBookSpeed(speeds: Record<string, number> | undefined, bookId: string, speed: number | null): Record<string, number> {
  const next = { ...(speeds ?? {}) };
  delete next[bookId];
  if (speed !== null) next[bookId] = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - BOOK_SPEEDS_MAX))) delete next[id];
  return next;
}

/** The patch a speed change makes: to the open book's own speed when it has one, else the profile's. */
export function speedPatch(player: PlayerSettings, bookId: string | null | undefined, speed: number): Partial<PlayerSettings> {
  return bookId && hasOwnSpeed(player, bookId) ? { bookSpeeds: withBookSpeed(player.bookSpeeds, bookId, speed) } : { speed };
}

/** Book speeds read back from the database: only ids with a speed in range. */
export function parseBookSpeeds(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [id, speed] of Object.entries(value as Record<string, unknown>)) {
    if (id.length <= 64 && typeof speed === "number" && speed >= SPEED_MIN && speed <= SPEED_MAX) out[id] = speed;
  }
  return out;
}
