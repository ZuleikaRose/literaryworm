import builtIn from "../data/changelog.json";

/**
 * What's new: the changes to LiteraryWorm, newest first. Entries come from Supabase
 * (changelog_entries), with the built-in copy in src/data/changelog.json shown until they load
 * and in a copy without the backend. The limits match the database.
 */

export type ChangeKind = "feature" | "fix" | "update";

export interface ChangeEntry {
  /** Null for the built-in copy (it can't be edited). */
  id: string | null;
  /** YYYY-MM-DD. */
  releasedOn: string;
  /** "2026.10", or "2026.10.1" for a point release. */
  version: string;
  kind: ChangeKind;
  title: string;
  body: string;
  /** Major changes go in the monthly email. */
  major: boolean;
}

export const CHANGE_KINDS: { value: ChangeKind; label: string; plural: string }[] = [
  { value: "feature", label: "New feature", plural: "New features" },
  { value: "update", label: "Update", plural: "Updates" },
  { value: "fix", label: "Fix", plural: "Fixes" },
];

export const kindLabel = (kind: ChangeKind) => CHANGE_KINDS.find((k) => k.value === kind)?.label ?? kind;

export const TITLE_MAX = 120;
export const BODY_MAX = 1000;
export const VERSION_PATTERN = /^\d{4}\.\d{1,2}(\.\d{1,3})?$/;

export const builtInEntries: ChangeEntry[] = (builtIn as Omit<ChangeEntry, "id">[]).map((e) => ({ ...e, id: null }));

/** Newest release first; within a day, the order they were written. */
export function sortEntries(entries: ChangeEntry[]): ChangeEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.releasedOn.localeCompare(a.e.releasedOn) || a.i - b.i)
    .map(({ e }) => e);
}

export interface Release {
  version: string;
  /** The newest day in the release. */
  releasedOn: string;
  entries: ChangeEntry[];
}

/** Entries grouped by version, newest first; major changes lead each release. */
export function groupReleases(entries: ChangeEntry[]): Release[] {
  const releases = new Map<string, Release>();
  for (const e of sortEntries(entries)) {
    const release = releases.get(e.version) ?? { version: e.version, releasedOn: e.releasedOn, entries: [] };
    release.entries.push(e);
    if (e.releasedOn > release.releasedOn) release.releasedOn = e.releasedOn;
    releases.set(e.version, release);
  }
  return [...releases.values()]
    .map((r) => ({ ...r, entries: [...r.entries.filter((e) => e.major), ...r.entries.filter((e) => !e.major)] }))
    .sort((a, b) => b.releasedOn.localeCompare(a.releasedOn));
}

export type ChangeFilter = ChangeKind | "all" | "new" | "major" | "minor";

/** How far back the What's new filter looks, in days. */
export const NEW_DAYS = 30;

/**
 * Everything, what's new (released in the last 30 days, `today` included), the major or minor
 * changes (minor: every change not marked major), or one kind.
 */
export function filterEntries(entries: ChangeEntry[], filter: ChangeFilter, today = new Date().toISOString().slice(0, 10)): ChangeEntry[] {
  if (filter === "all") return entries;
  if (filter === "new") {
    const [y, m, d] = today.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, d - (NEW_DAYS - 1))).toISOString().slice(0, 10);
    return entries.filter((e) => e.releasedOn >= from && e.releasedOn <= today);
  }
  if (filter === "major") return entries.filter((e) => e.major);
  if (filter === "minor") return entries.filter((e) => !e.major);
  return entries.filter((e) => e.kind === filter);
}

/** "October 2026" for a version's month, from its first entry's date. */
export function releaseLabel(releasedOn: string): string {
  const [y, m] = releasedOn.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

/** "30 October 2026". */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

export type ChangeInput = Omit<ChangeEntry, "id">;

/** A plain-words problem with an entry, or null when the database will take it. */
export function entryError(e: ChangeInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.releasedOn) || Number.isNaN(Date.parse(e.releasedOn))) return "Choose the day it was released.";
  if (!VERSION_PATTERN.test(e.version.trim())) return "Write the version like 2026.10, or 2026.10.1 for a smaller release.";
  if (!CHANGE_KINDS.some((k) => k.value === e.kind)) return "Choose new feature, update or fix.";
  const title = e.title.trim();
  if (!title) return "Give the change a title.";
  if (title.length > TITLE_MAX) return `Keep the title to ${TITLE_MAX} characters.`;
  const body = e.body.trim();
  if (!body) return "Say what changed, in a sentence or two.";
  if (body.length > BODY_MAX) return `Keep it to ${BODY_MAX} characters.`;
  return null;
}

/** The version for a date: "2026.10" for any day in October 2026. */
export const versionFor = (day: string) => `${day.slice(0, 4)}.${Number(day.slice(5, 7))}`;
