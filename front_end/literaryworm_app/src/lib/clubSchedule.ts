import { tk } from "./i18n";

/**
 * A club's reading schedule: the owner sets how many chapters a week (book_clubs.chapters_per_week,
 * migration 6740), counted in weeks from the club's start date. Each member sees this week's
 * chapters and whether they're on track, from their own place in the book. Worked out in the
 * browser, never stored.
 */

/** Chapters a week the owner can choose. */
export const CHAPTERS_PER_WEEK = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20] as const;
export const CHAPTERS_PER_WEEK_MAX = 100;

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export interface ScheduleWeek {
  /** 1 for the club's first week. */
  week: number;
  /** The week's first and last day (YYYY-MM-DD). */
  startsOn: string;
  endsOn: string;
  /** Chapter indexes, 0-based, both included. */
  from: number;
  to: number;
  /** Past the book's last chapter: the schedule has finished. */
  finished: boolean;
}

/** The week `today` falls in (the first week before the start). */
export function scheduleWeek(startsOn: string, perWeek: number, today: string, chapters: number): ScheduleWeek {
  const index = Math.max(0, Math.floor((toTime(today) - toTime(startsOn)) / (7 * DAY_MS)));
  const from = index * perWeek;
  const start = toTime(startsOn) + index * 7 * DAY_MS;
  return {
    week: index + 1,
    startsOn: toDay(start),
    endsOn: toDay(start + 6 * DAY_MS),
    from: Math.min(from, Math.max(0, chapters - 1)),
    to: Math.min(from + perWeek - 1, Math.max(0, chapters - 1)),
    finished: from >= chapters,
  };
}

/** How many weeks the schedule takes to finish the book. */
export const scheduleWeeks = (perWeek: number, chapters: number) => Math.max(1, Math.ceil(chapters / perWeek));

export type Standing = { kind: "ahead" | "onTrack" | "behind"; chapters: number };

/**
 * Where a member is against the week: on track while their chapter is in this week's chapters,
 * ahead past them, behind before them. `mine` is their chapter index, -1 before starting.
 */
export function scheduleStanding(mine: number, week: ScheduleWeek): Standing {
  if (mine > week.to) return { kind: "ahead", chapters: mine - week.to };
  if (mine >= week.from) return { kind: "onTrack", chapters: 0 };
  return { kind: "behind", chapters: week.from - mine };
}

/** A plain-words problem with a chapters-a-week value, or null. */
export function perWeekError(value: number | null): string | null {
  if (value === null) return null;
  return Number.isInteger(value) && value >= 1 && value <= CHAPTERS_PER_WEEK_MAX ? null : tk("Choose how many chapters a week.");
}
