import type { ReadingDay } from "../types";
import { STREAK_SECONDS } from "./goals";

/**
 * Household reading challenges: a target for a stretch of days that the account's profiles
 * take on together. Progress is worked out from each profile's reading days (keyed by local
 * date, YYYY-MM-DD), the same records as goals and stats. The limits match the database.
 */

export type ChallengeKind = "books" | "hours" | "days";

export interface Challenge {
  id: string;
  title: string;
  kind: ChallengeKind;
  target: number;
  /** Local dates, YYYY-MM-DD, both included. */
  startsOn: string;
  endsOn: string;
  /** The profile that started it; null once that profile is deleted. */
  createdBy: string | null;
  /** Profile ids that joined, in the order they joined. */
  participants: string[];
}

export const CHALLENGE_KINDS: { value: ChallengeKind; label: string }[] = [
  { value: "books", label: "Books finished" },
  { value: "hours", label: "Hours reading and listening" },
  { value: "days", label: "Days with reading" },
];

export const CHALLENGES_MAX = 20;
export const CHALLENGE_TITLE_MAX = 80;
export const CHALLENGE_TARGET_MAX = 1000;
/** The longest a challenge can run. */
export const CHALLENGE_DAYS_MAX = 367;

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "book" / "books", "hour" / "hours", "day" / "days". */
export function unit(kind: ChallengeKind, n: number): string {
  const word = { books: "book", hours: "hour", days: "day" }[kind];
  return n === 1 ? word : `${word}s`;
}

/** Days from start to end, both included. */
export const challengeLength = (startsOn: string, endsOn: string) => Math.round((toTime(endsOn) - toTime(startsOn)) / DAY_MS) + 1;

/** How far a profile has got: books finished, whole hours, or days with a minute's reading, in the range. */
export function challengeValue(kind: ChallengeKind, days: Record<string, ReadingDay>, startsOn: string, endsOn: string): number {
  let books = 0;
  let seconds = 0;
  let daysRead = 0;
  for (const [day, d] of Object.entries(days)) {
    if (day < startsOn || day > endsOn) continue;
    books += d.finished;
    seconds += d.seconds;
    if (d.seconds >= STREAK_SECONDS) daysRead += 1;
  }
  return kind === "books" ? books : kind === "hours" ? Math.floor(seconds / 3600) : daysRead;
}

export type ChallengeStatus = "upcoming" | "active" | "ended";

export function challengeStatus(c: Pick<Challenge, "startsOn" | "endsOn">, today: string): ChallengeStatus {
  if (today < c.startsOn) return "upcoming";
  return today > c.endsOn ? "ended" : "active";
}

/** Days left including today, for an active challenge. */
export const daysLeft = (c: Pick<Challenge, "endsOn">, today: string) => Math.max(0, challengeLength(today, c.endsOn));

export interface Standing {
  profileId: string;
  value: number;
  done: boolean;
}

/** Everyone who joined, furthest along first (ties keep the order they joined). */
export function standings(c: Challenge, daysByProfile: Record<string, Record<string, ReadingDay> | undefined>): Standing[] {
  return c.participants
    .map((profileId) => {
      const value = challengeValue(c.kind, daysByProfile[profileId] ?? {}, c.startsOn, c.endsOn);
      return { profileId, value, done: value >= c.target };
    })
    .sort((a, b) => b.value - a.value);
}

export type RangePreset = "this-month" | "next-month" | "next-30";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "next-month", label: "Next month" },
  { value: "next-30", label: "The next 30 days" },
];

/** The dates a preset covers, from `today` (YYYY-MM-DD). */
export function presetRange(preset: RangePreset, today: string): { startsOn: string; endsOn: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  if (preset === "this-month") return { startsOn: toDay(Date.UTC(year, month, 1)), endsOn: toDay(Date.UTC(year, month + 1, 0)) };
  if (preset === "next-month") return { startsOn: toDay(Date.UTC(year, month + 1, 1)), endsOn: toDay(Date.UTC(year, month + 2, 0)) };
  return { startsOn: today, endsOn: toDay(toTime(today) + 29 * DAY_MS) };
}

const monthName = (day: string) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(toTime(day));
const dayAndMonth = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(toTime(day));

/** "5 books in November" for a whole month, else "20 hours by 30 November". */
export function defaultTitle(kind: ChallengeKind, target: number, startsOn: string, endsOn: string): string {
  const what = `${target} ${unit(kind, target)}`;
  const wholeMonth = startsOn.slice(8) === "01" && startsOn.slice(0, 7) === endsOn.slice(0, 7) && toDay(toTime(endsOn) + DAY_MS).slice(8) === "01";
  return wholeMonth ? `${what} in ${monthName(startsOn)}` : `${what} by ${dayAndMonth(endsOn)}`;
}

/** "1 December". */
export const dayLabel = (day: string) => dayAndMonth(day);

/** "1 – 30 November", for lists. */
export function rangeLabel(startsOn: string, endsOn: string): string {
  return `${dayAndMonth(startsOn)} – ${dayAndMonth(endsOn)}`;
}

export interface ChallengeInput {
  title: string;
  kind: ChallengeKind;
  target: number;
  startsOn: string;
  endsOn: string;
}

/** A plain-words problem with a new challenge, or null when the database will take it. */
export function challengeError(input: ChallengeInput, today: string): string | null {
  const title = input.title.trim();
  if (!title) return "Give the challenge a name.";
  if (title.length > CHALLENGE_TITLE_MAX) return `Keep the name to ${CHALLENGE_TITLE_MAX} characters.`;
  if (!Number.isInteger(input.target) || input.target < 1 || input.target > CHALLENGE_TARGET_MAX) {
    return `Enter a whole number from 1 to ${CHALLENGE_TARGET_MAX}.`;
  }
  if (!DATE.test(input.startsOn) || !DATE.test(input.endsOn)) return "Choose when it starts and ends.";
  if (input.endsOn < input.startsOn) return "The end date can't be before the start.";
  if (input.endsOn < today) return "Choose dates that haven't passed yet.";
  const length = challengeLength(input.startsOn, input.endsOn);
  if (length > CHALLENGE_DAYS_MAX) return "A challenge can run for a year at most.";
  if (input.kind === "days" && input.target > length) return `There are only ${length} days in that range.`;
  return null;
}
