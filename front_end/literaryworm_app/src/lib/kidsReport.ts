import type { ReadingDay } from "../types";
import { STREAK_SECONDS } from "./goals";

/** A Kids profile's week, for the grown-ups (Account → Family, and the weekly email). */
export interface KidWeek {
  /** Seconds read or listened. */
  seconds: number;
  /** Of `seconds`, the listening. */
  listened: number;
  /** Days with at least a minute, out of 7. */
  daysRead: number;
  finished: number;
  /** The books finished, where known (newest day first). */
  books: string[];
}

/** The 7 days up to and including `today` (YYYY-MM-DD, local), newest first. */
export function lastSevenDays(today: string): string[] {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d - i));
    return day.toISOString().slice(0, 10);
  });
}

/** A profile's reading over the last 7 days, today included. */
export function kidWeek(days: Record<string, ReadingDay>, today: string): KidWeek {
  const week: KidWeek = { seconds: 0, listened: 0, daysRead: 0, finished: 0, books: [] };
  for (const day of lastSevenDays(today)) {
    const d = days[day];
    if (!d) continue;
    week.seconds += d.seconds;
    week.listened += d.listened ?? 0;
    week.finished += d.finished;
    if (d.seconds >= STREAK_SECONDS) week.daysRead += 1;
    for (const id of d.books ?? []) if (!week.books.includes(id)) week.books.push(id);
  }
  return week;
}

/** How a Kids profile's last 7 days compare with the weekly goal a grown-up set (minutes). */
export interface WeeklyGoal {
  /** Whole minutes read or listened in the last 7 days. */
  minutes: number;
  goal: number;
  reached: boolean;
  /** Minutes still to go (0 once reached). */
  left: number;
}

export function weeklyGoal(days: Record<string, ReadingDay>, goalMinutes: number | null, today: string): WeeklyGoal | null {
  if (!goalMinutes) return null;
  const minutes = Math.floor(kidWeek(days, today).seconds / 60);
  return { minutes, goal: goalMinutes, reached: minutes >= goalMinutes, left: Math.max(goalMinutes - minutes, 0) };
}
