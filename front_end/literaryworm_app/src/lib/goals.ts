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

/** A streak this long or longer gets a nudge in the bell when it's about to end. */
export const STREAK_NUDGE_DAYS = 3;
/** The nudge starts at this local hour, when there's still time to read. */
export const STREAK_NUDGE_HOUR = 18;
/** How many books from the goal counts as close. */
export const GOAL_CLOSE_BOOKS = 2;
/** How long reaching the goal stays in the bell. */
export const GOAL_REACHED_DAYS = 7;

export type GoalAlert =
  | { kind: "streak"; days: number; at: number }
  | { kind: "close"; left: number; goal: number; year: number; at: number }
  | { kind: "reached"; goal: number; year: number; at: number };

/** Local midnight of a YYYY-MM-DD day, in ms. */
const localMidnight = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))).getTime();

/**
 * What the bell says about a profile's goals and streak (`today` is the local date, `now` the
 * time): a streak of 3 days or more that ends tonight unless the profile reads (from 6 pm, until
 * it does); this year's goal within 2 books (from the day that became true); and the goal
 * reached (for a week from that day). Each has the time it started, so the bell can mark it new.
 */
export function goalAlerts(days: Record<string, ReadingDay>, goals: Record<number, number>, today: string, now: Date): GoalAlert[] {
  const alerts: GoalAlert[] = [];
  const readToday = (days[today]?.seconds ?? 0) >= STREAK_SECONDS;
  const { current } = streaks(days, today);
  if (!readToday && current >= STREAK_NUDGE_DAYS && now.getHours() >= STREAK_NUDGE_HOUR) {
    alerts.push({ kind: "streak", days: current, at: localMidnight(today) + STREAK_NUDGE_HOUR * 3_600_000 });
  }

  const year = Number(today.slice(0, 4));
  const goal = goals[year];
  if (goal) {
    // The days books were finished this year, in order, to find when each milestone was passed.
    let finished = 0;
    let closeOn: string | null = null;
    let reachedOn: string | null = null;
    for (const [day, d] of Object.entries(days).filter(([day, d]) => day.startsWith(`${year}-`) && day <= today && d.finished > 0).sort(([a], [b]) => a.localeCompare(b))) {
      finished += d.finished;
      if (!closeOn && goal - finished <= GOAL_CLOSE_BOOKS) closeOn = day;
      if (!reachedOn && finished >= goal) reachedOn = day;
    }
    if (reachedOn) {
      const at = localMidnight(reachedOn);
      if (now.getTime() - at < GOAL_REACHED_DAYS * DAY_MS) alerts.push({ kind: "reached", goal, year, at });
    } else if (closeOn && goal > GOAL_CLOSE_BOOKS) {
      alerts.push({ kind: "close", left: goal - finished, goal, year, at: localMidnight(closeOn) });
    }
  }
  return alerts;
}
