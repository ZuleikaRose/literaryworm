import type { ReadingPlan } from "../types";
import { tr } from "./i18n";
import { DEFAULT_WPM } from "./pace";

export type { ReadingPlan };

/**
 * Reading plans: "finish this book by a date". From where the reader is now, the plan works out
 * how much a day gets there (pages, and minutes at the profile's own pace: the book's measured
 * pace from Your time with this book once there's enough, else words a minute over the book's
 * pages), and whether they're ahead of or behind a steady pace from the day the plan started.
 * Per profile and book: members' in `reading_plans` (migration 6570), in-memory accounts' in
 * `ProfileData.readingPlans`.
 */
/** Up to this many plans a profile, and a finish date at most this many days ahead. */
export const PLANS_MAX = 20;
export const PLAN_DAYS_MAX = 730;
/** Words on a printed page, to turn pages into reading time when the pace isn't measured yet. */
export const WORDS_PER_PAGE = 275;

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string) => Math.round(dayNumber(b) - dayNumber(a));

/** Why a finish date can't be used, or null when it can: today or later, at most two years ahead. */
export function planDateError(finishBy: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(finishBy) || Number.isNaN(dayNumber(finishBy))) return tr("Choose the day you'd like to finish by.");
  const ahead = daysBetween(today, finishBy);
  if (ahead < 0) return tr("Choose today or a day still to come.");
  if (ahead > PLAN_DAYS_MAX) return tr("Choose a day within the next two years.");
  return null;
}

export type PlanStatus = "done" | "overdue" | "ahead" | "on-track" | "behind";

export interface PlanToday {
  status: PlanStatus;
  /** Days left including today (0 once the date has passed). */
  daysLeft: number;
  /** A day's share of what's left, rounded up; null when the book has no page count. */
  pagesPerDay: number | null;
  minutesPerDay: number;
  /** How many days' worth ahead (positive) or behind (negative) a steady pace the reader is. */
  daysAhead: number;
}

/**
 * Today's plan. `fraction` is the reader's place (0–1); `perHour` the measured pace through this
 * book (bookStats().perHour) or null; `wpm` the profile's reading speed or null.
 */
export function planToday(
  plan: ReadingPlan,
  book: { pages: number },
  fraction: number,
  today: string,
  perHour: number | null,
  wpm: number | null,
): PlanToday {
  const at = Math.min(1, Math.max(0, fraction));
  const left = 1 - at;
  const daysLeft = Math.max(0, daysBetween(today, plan.finishBy) + 1);
  if (left <= 0) return { status: "done", daysLeft, pagesPerDay: 0, minutesPerDay: 0, daysAhead: 0 };

  const hoursLeft =
    perHour && perHour > 0 ? left / perHour : (Math.max(1, book.pages) * left * WORDS_PER_PAGE) / (wpm && wpm > 0 ? wpm : DEFAULT_WPM) / 60;
  const spread = Math.max(1, daysLeft);
  const pagesPerDay = book.pages > 0 ? Math.ceil((book.pages * left) / spread) : null;
  const minutesPerDay = Math.max(1, Math.ceil((hoursLeft * 60) / spread));
  if (daysLeft === 0) return { status: "overdue", daysLeft, pagesPerDay, minutesPerDay, daysAhead: 0 };

  // A steady pace from the start: where the reader would be at the start of today.
  const totalDays = Math.max(1, daysBetween(plan.startedOn, plan.finishBy) + 1);
  const perDay = (1 - plan.startFraction) / totalDays;
  const expected = plan.startFraction + perDay * Math.max(0, daysBetween(plan.startedOn, today));
  // Whole days only; the small allowance stops 1.9999… (from floating point) counting as 1.
  const raw = perDay > 0 ? (at - expected) / perDay : 0;
  const daysAhead = Math.trunc(raw + Math.sign(raw) * 1e-9);
  const status: PlanStatus = daysAhead >= 1 ? "ahead" : daysAhead <= -1 ? "behind" : "on-track";
  return { status, daysLeft, pagesPerDay, minutesPerDay, daysAhead };
}

/** "About 25 minutes or 14 pages a day". */
export function dailyText(t: Pick<PlanToday, "minutesPerDay" | "pagesPerDay">): string {
  const h = Math.floor(t.minutesPerDay / 60);
  const m = t.minutesPerDay % 60;
  const minutes =
    t.minutesPerDay >= 60
      ? m
        ? tr("{h} hr {m} min", { h, m })
        : tr("{h} hr", { h })
      : tr.plural(t.minutesPerDay, { one: "{count} minute", other: "{count} minutes" });
  return t.pagesPerDay
    ? tr.plural(t.pagesPerDay, { one: "About {minutes} or {count} page a day", other: "About {minutes} or {count} pages a day" }, { minutes })
    : tr("About {minutes} a day", { minutes });
}

/** "2 days ahead", "On track", "1 day behind", "Finished", "The date has passed". */
export function statusText(t: Pick<PlanToday, "status" | "daysAhead">): string {
  switch (t.status) {
    case "done":
      return tr("Finished");
    case "overdue":
      return tr("The date has passed");
    case "ahead":
      return tr.plural(t.daysAhead, { one: "{count} day ahead", other: "{count} days ahead" });
    case "behind":
      return tr.plural(-t.daysAhead, { one: "{count} day behind", other: "{count} days behind" });
    default:
      return tr("On track");
  }
}
