import type { BookDay } from "../types";

/**
 * Reading statistics for one book: the time a profile spent with it, day by day, and where in the
 * book each day started and ended (fractions of the whole book, like reading progress). Worked out
 * in the browser; members' days come from `book_reading_days` (whole minutes), in-memory
 * accounts' from `ProfileData.bookDays`.
 */

/** Adds time with a book to a day. `fraction` is where the reader is now (0–1), if known. */
export function addBookTime(
  all: Record<string, Record<string, BookDay>> | undefined,
  bookId: string,
  day: string,
  seconds: number,
  listening: boolean,
  fraction: number | null,
): Record<string, Record<string, BookDay>> {
  const book = all?.[bookId] ?? {};
  const now = book[day] ?? { seconds: 0, listened: 0, from: null, to: null };
  const at = fraction === null || !Number.isFinite(fraction) ? null : Math.min(1, Math.max(0, fraction));
  const next: BookDay = {
    seconds: now.seconds + seconds,
    listened: now.listened + (listening ? seconds : 0),
    from: now.from ?? at,
    to: at ?? now.to,
  };
  return { ...all, [bookId]: { ...book, [day]: next } };
}

export interface BookStats {
  seconds: number;
  /** Of `seconds`, the listening part. */
  listened: number;
  /** Days with any time, and the first and last of them (YYYY-MM-DD). */
  days: number;
  first: string;
  last: string;
  /** How much of the book an hour moves the reader on (0–1), when there's enough to tell. */
  perHour: number | null;
  /** At that pace, seconds to the end from `at`, when known. */
  leftSeconds: number | null;
  /** The days with the most time, most first (up to three). */
  topDays: { day: string; seconds: number }[];
}

/** Below this much measured time the pace isn't shown: a few minutes say little about a book. */
export const PACE_MIN_SECONDS = 15 * 60;

export function bookStats(days: Record<string, BookDay> | undefined, at: number | null = null): BookStats | null {
  const entries = Object.entries(days ?? {}).filter(([, d]) => d.seconds > 0);
  if (entries.length === 0) return null;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let seconds = 0;
  let listened = 0;
  let paced = 0;
  let moved = 0;
  for (const [, d] of entries) {
    seconds += d.seconds;
    listened += Math.min(d.seconds, d.listened);
    if (d.from !== null && d.to !== null) {
      paced += d.seconds;
      moved += Math.max(0, d.to - d.from);
    }
  }
  const perHour = paced >= PACE_MIN_SECONDS && moved > 0 ? moved / (paced / 3600) : null;
  const leftSeconds = perHour !== null && at !== null && at < 1 ? Math.round(((1 - at) / perHour) * 3600) : null;
  const topDays = entries
    .map(([day, d]) => ({ day, seconds: d.seconds }))
    .sort((a, b) => b.seconds - a.seconds || (a.day < b.day ? 1 : -1))
    .slice(0, 3);
  return { seconds, listened, days: entries.length, first: entries[0][0], last: entries[entries.length - 1][0], perHour, leftSeconds, topDays };
}

/** "3 hr 20 min", "45 min", "under a minute". */
export function spentText(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "About 12% an hour". */
export function paceText(perHour: number): string {
  const percent = perHour * 100;
  return percent < 1 ? "Under 1% of the book an hour" : `About ${Math.round(percent)}% of the book an hour`;
}

/** Rows from `book_reading_days` as days. */
export function bookDaysFromRows(
  rows: { day: string; minutes: number; listening_minutes: number; fraction_from: number | string | null; fraction_to: number | string | null }[],
): Record<string, BookDay> {
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return Object.fromEntries(
    rows.map((r) => [r.day, { seconds: r.minutes * 60, listened: r.listening_minutes * 60, from: num(r.fraction_from), to: num(r.fraction_to) }]),
  );
}
