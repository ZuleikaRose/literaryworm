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

/** Rest days a month: a missed day that doesn't end a streak, used up automatically. */
export const REST_DAYS_PER_MONTH = 2;

export interface Streaks {
  /** Days read in the current streak (rest days hold it together but don't add to it). */
  current: number;
  longest: number;
  /** The rest days the current streak used, oldest first (YYYY-MM-DD). */
  restDays: string[];
  /** Rest days still free this month. */
  restLeft: number;
}

/**
 * Streaks with rest days. A day counts once a minute is read or listened. A gap of missed days
 * doesn't end a streak when every month it falls in still has rest days for it (2 a month,
 * REST_DAYS_PER_MONTH, used oldest first); a longer gap ends it. Today never needs one: the
 * streak runs up to today, or up to yesterday while today has nothing yet. A streak's length is
 * the days read; rest days only hold it together.
 */
export function streaks(days: Record<string, ReadingDay>, today: string): Streaks {
  const read = [...new Set(Object.entries(days).filter(([day, d]) => d.seconds >= STREAK_SECONDS && day <= today).map(([day]) => day))].sort();
  const used = new Map<string, number>();
  const left = (month: string) => REST_DAYS_PER_MONTH - (used.get(month) ?? 0);

  /** The missed days between two times (exclusive), if every month in them has room; null otherwise. */
  const bridge = (from: number, to: number): string[] | null => {
    const missed: string[] = [];
    for (let at = from + DAY_MS; at < to; at += DAY_MS) missed.push(toDay(at));
    const need = new Map<string, number>();
    for (const day of missed) need.set(day.slice(0, 7), (need.get(day.slice(0, 7)) ?? 0) + 1);
    return [...need].every(([month, n]) => n <= left(month)) ? missed : null;
  };
  const spend = (missed: string[]) => {
    for (const day of missed) used.set(day.slice(0, 7), (used.get(day.slice(0, 7)) ?? 0) + 1);
  };

  let run = 0;
  let longest = 0;
  let rests: string[] = [];
  let previous: number | null = null;
  for (const day of read) {
    const time = toTime(day);
    const missed = previous === null ? null : bridge(previous, time);
    if (missed) {
      spend(missed);
      rests = [...rests, ...missed];
      run += 1;
    } else {
      run = 1;
      rests = [];
    }
    longest = Math.max(longest, run);
    previous = time;
  }

  // From the last day read to today: today itself is never missed yet.
  let current = 0;
  if (previous !== null) {
    const missed = bridge(previous, toTime(today));
    if (missed) {
      spend(missed);
      current = run;
      rests = [...rests, ...missed];
    }
  }
  return { current, longest, restDays: current ? rests : [], restLeft: Math.max(0, left(today.slice(0, 7))) };
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
 * it does, and only once this month's rest days are used up); this year's goal within 2 books (from the day that became true); and the goal
 * reached (for a week from that day). Each has the time it started, so the bell can mark it new.
 */
export function goalAlerts(days: Record<string, ReadingDay>, goals: Record<number, number>, today: string, now: Date): GoalAlert[] {
  const alerts: GoalAlert[] = [];
  const readToday = (days[today]?.seconds ?? 0) >= STREAK_SECONDS;
  const { current, restLeft } = streaks(days, today);
  // With a rest day left this month, missing today doesn't end the streak, so no nudge.
  if (!readToday && restLeft === 0 && current >= STREAK_NUDGE_DAYS && now.getHours() >= STREAK_NUDGE_HOUR) {
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
