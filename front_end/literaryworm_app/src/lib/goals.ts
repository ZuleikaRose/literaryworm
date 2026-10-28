import type { ReadingDay } from "../types";

/** Goals and streaks, worked out from a profile's reading days (keyed by local date, YYYY-MM-DD). */

export const GOAL_MIN = 1;
export const GOAL_MAX = 365;
/** A day counts towards a streak once a minute has been read or listened. */
export const STREAK_SECONDS = 60;

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function booksFinishedIn(days: Record<string, ReadingDay>, year: number): number {
  const prefix = `${year}-`;
  return Object.entries(days).reduce((sum, [day, d]) => (day.startsWith(prefix) ? sum + d.finished : sum), 0);
}

/**
 * The current streak (days in a row up to today, or up to yesterday while today has nothing yet)
 * and the longest one in the days loaded.
 */
export function streaks(days: Record<string, ReadingDay>, today: string): { current: number; longest: number } {
  const read = new Set(Object.entries(days).filter(([, d]) => d.seconds >= STREAK_SECONDS).map(([day]) => day));
  let current = 0;
  let at = read.has(today) ? toTime(today) : toTime(today) - DAY_MS;
  while (read.has(toDay(at))) {
    current += 1;
    at -= DAY_MS;
  }
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const time of [...read].map(toTime).sort((a, b) => a - b)) {
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }
  return { current, longest };
}

export interface MonthSummary {
  /** YYYY-MM */
  month: string;
  seconds: number;
  daysRead: number;
  finished: number;
}

/** This month and the `count - 1` before it, newest first. */
export function monthSummaries(days: Record<string, ReadingDay>, today: string, count = 6): MonthSummary[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - i, 1));
    const key = date.toISOString().slice(0, 7);
    const summary: MonthSummary = { month: key, seconds: 0, daysRead: 0, finished: 0 };
    for (const [day, d] of Object.entries(days)) {
      if (!day.startsWith(key)) continue;
      summary.seconds += d.seconds;
      summary.finished += d.finished;
      if (d.seconds >= STREAK_SECONDS) summary.daysRead += 1;
    }
    return summary;
  });
}

/** How many books should be finished by `today` to meet the goal at an even pace. */
export function expectedByNow(goal: number, today: string): number {
  const year = Number(today.slice(0, 4));
  const start = Date.UTC(year, 0, 1);
  const length = Date.UTC(year + 1, 0, 1) - start;
  return (goal * (toTime(today) - start + DAY_MS)) / length;
}

/** 12_000 → "3 h 20 min"; 300 → "5 min"; under a minute → "0 min". */
export function readingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
