/**
 * Reading sprints: a timed session (15 to 30 minutes) that a household's profiles or a book club's
 * members join. Everyone works out the same timer from the sprint's start and end, and each device
 * counts the pages turned forward in the reader while it runs (lib/sprintCounter.ts), saved when it
 * ends. The rules here are pure; the database (migration 6649) checks them again.
 */

export const SPRINT_MINUTES = [15, 20, 25, 30] as const;
export type SprintMinutes = (typeof SPRINT_MINUTES)[number];
export const DEFAULT_SPRINT_MINUTES: SprintMinutes = 20;
/** The most pages a sprint saves for one reader (the database's limit). */
export const SPRINT_PAGES_MAX = 2000;

/** A household's sprint or one club's. */
export type SprintScope = { kind: "household" } | { kind: "club"; clubId: string };

export interface Sprint {
  id: string;
  clubId: string | null;
  minutes: number;
  /** Milliseconds since 1970. */
  startsAt: number;
  endsAt: number;
}

export interface SprintReader {
  profileId: string;
  /** A household sees its profiles' names; a club sees each member's display name. */
  name: string;
  /** Saved when the sprint ends; null until then. */
  pages: number | null;
  finished: boolean;
  /** One of this account's profiles. */
  mine: boolean;
}

export const isSprintMinutes = (n: number): n is SprintMinutes => (SPRINT_MINUTES as readonly number[]).includes(n);

export const scopeKey = (scope: SprintScope) => (scope.kind === "club" ? `club:${scope.clubId}` : "household");

export const isRunning = (sprint: Sprint | null, now: number) => Boolean(sprint && now >= sprint.startsAt && now < sprint.endsAt);

/** Whole seconds left, 0 once it has ended. */
export const secondsLeft = (sprint: Sprint, now: number) => Math.max(0, Math.ceil((sprint.endsAt - now) / 1000));

/** 14:05, 0:09: minutes and seconds, as a timer shows them. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A page count fit to save: whole, 0 to 2,000. */
export const pagesToSave = (pages: number) => Math.min(SPRINT_PAGES_MAX, Math.max(0, Math.round(Number.isFinite(pages) ? pages : 0)));

/** Readers by pages read (most first; those still to save last), then by name. */
export function rankReaders(readers: SprintReader[]): SprintReader[] {
  return [...readers].sort((a, b) => (b.pages ?? -1) - (a.pages ?? -1) || a.name.localeCompare(b.name));
}

/** Pages everyone in the sprint read, together. */
export const totalPages = (readers: SprintReader[]) => readers.reduce((n, r) => n + (r.pages ?? 0), 0);
