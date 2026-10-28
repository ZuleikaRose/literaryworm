import { getBook } from "../data/books";
import type { Book, Highlight, ReadingDay } from "../types";
import { STREAK_SECONDS } from "./goals";

/**
 * Reading stats and Year in Review, worked out from a profile's reading days (time read and
 * listened, books finished) and highlights. Days are keyed by local date, YYYY-MM-DD.
 */

export interface MonthStat {
  /** 0–11 */
  month: number;
  seconds: number;
  listened: number;
}

export interface Count {
  name: string;
  count: number;
}

export interface YearStats {
  year: number;
  seconds: number;
  listened: number;
  read: number;
  daysRead: number;
  /** Books finished (the count, which includes books we don't know the names of). */
  finished: number;
  /** The finished books we know, newest first. Catalog titles only have genres. */
  books: { id: string; book: Book | undefined; day: string }[];
  longestStreak: number;
  months: MonthStat[];
  /** The month with the most time, or null with none. */
  busiestMonth: number | null;
  /** 0 = Sunday. The weekday with the most time, or null with none. */
  favouriteWeekday: number | null;
  genres: Count[];
  authors: Count[];
  highlights: number;
  notes: number;
}

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/** The years with any reading, newest first, always including `current`. */
export function statsYears(days: Record<string, ReadingDay>, current: number): number[] {
  const years = new Set([current, ...Object.keys(days).map((d) => Number(d.slice(0, 4)))]);
  return [...years].filter((y) => y <= current).sort((a, b) => b - a);
}

function top(counts: Map<string, number>, limit: number): Count[] {
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function yearStats(days: Record<string, ReadingDay>, highlights: Highlight[], year: number): YearStats {
  const prefix = `${year}-`;
  const entries = Object.entries(days)
    .filter(([day]) => day.startsWith(prefix))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const months: MonthStat[] = Array.from({ length: 12 }, (_, month) => ({ month, seconds: 0, listened: 0 }));
  const weekdays = Array.from({ length: 7 }, () => 0);
  let seconds = 0;
  let listened = 0;
  let finished = 0;
  let daysRead = 0;
  let longestStreak = 0;
  let run = 0;
  let previous: number | null = null;
  const books: YearStats["books"] = [];
  const genres = new Map<string, number>();
  const authors = new Map<string, number>();

  for (const [day, d] of entries) {
    const heard = Math.min(d.seconds, d.listened ?? 0);
    seconds += d.seconds;
    listened += heard;
    finished += d.finished;
    const month = months[Number(day.slice(5, 7)) - 1];
    month.seconds += d.seconds;
    month.listened += heard;
    const time = toTime(day);
    weekdays[new Date(time).getUTCDay()] += d.seconds;
    if (d.seconds >= STREAK_SECONDS) {
      daysRead += 1;
      run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = time;
    }
    for (const id of d.books ?? []) {
      const book = getBook(id);
      books.push({ id, book, day });
      if (!book) continue;
      for (const genre of book.genres.slice(0, 2)) genres.set(genre, (genres.get(genre) ?? 0) + 1);
      authors.set(book.author, (authors.get(book.author) ?? 0) + 1);
    }
  }

  const busiest = months.reduce<MonthStat | null>((best, m) => (m.seconds > 0 && (!best || m.seconds > best.seconds) ? m : best), null);
  const weekdayMax = Math.max(...weekdays);
  const inYear = highlights.filter((h) => new Date(h.createdAt).getFullYear() === year);

  return {
    year,
    seconds,
    listened,
    read: seconds - listened,
    daysRead,
    finished,
    books: books.reverse(),
    longestStreak,
    months,
    busiestMonth: busiest?.month ?? null,
    favouriteWeekday: weekdayMax > 0 ? weekdays.indexOf(weekdayMax) : null,
    genres: top(genres, 5),
    authors: top(authors, 5),
    highlights: inYear.length,
    notes: inYear.filter((h) => h.note).length,
  };
}
