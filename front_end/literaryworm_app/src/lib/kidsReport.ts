import type { QuizResult, ReadingDay } from "../types";
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

/**
 * How a Kids profile's week went, so a big household's report reads in groups: still working
 * towards a goal first, then no reading yet, reading without a goal, and goals reached. The
 * kids-report email groups the same way (kidGroup() in supabase/functions/kids-report/email.ts).
 */
export type KidGroup = "toGo" | "notYet" | "reading" | "reached";

export const KID_GROUPS: { id: KidGroup; heading: string }[] = [
  { id: "toGo", heading: "Still working on their goal" },
  { id: "notYet", heading: "No reading yet" },
  { id: "reading", heading: "Reading, no goal set" },
  { id: "reached", heading: "Goal reached" },
];

/** Which group a week falls in: `seconds` read or listened, and the weekly goal if one is set. */
export function kidGroup(seconds: number, goal: WeeklyGoal | null): KidGroup {
  if (goal) return goal.reached ? "reached" : "toGo";
  return seconds < 60 ? "notYet" : "reading";
}

/** The kids in their groups, in KID_GROUPS order and their own order within; empty groups left out. */
export function groupKids<T>(kids: T[], groupOf: (kid: T) => KidGroup): { id: KidGroup; heading: string; kids: T[] }[] {
  return KID_GROUPS.map((g) => ({ ...g, kids: kids.filter((k) => groupOf(k) === g.id) })).filter((g) => g.kids.length > 0);
}

/** Chapter quizzes taken in the last 7 days (each chapter's latest try): how many, and the answers right. */
export function quizWeek(results: QuizResult[], today: string): { taken: number; right: number; of: number } | null {
  const days = new Set(lastSevenDays(today));
  const local = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const week = results.filter((r) => days.has(local(r.takenAt)));
  if (week.length === 0) return null;
  return { taken: week.length, right: week.reduce((n, r) => n + r.score, 0), of: week.reduce((n, r) => n + r.outOf, 0) };
}
