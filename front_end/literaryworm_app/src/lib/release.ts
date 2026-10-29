import type { Reminder } from "../types";
import { today } from "./reading";

/** Release dates for Remind Me. Dates are YYYY-MM-DD strings, compared with the device's today. */

/** The same limit as the database. */
export const REMINDERS_MAX = 100;

/**
 * The first day a book is out, from Google Books' publishedDate ("2027", "2027-03",
 * "2027-03-14" or with a time). A year or month alone counts from its first day.
 */
export function releaseDay(published: string | null): string | null {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(published ?? "");
  if (!m) return null;
  return `${m[1]}-${m[2] ?? "01"}-${m[3] ?? "01"}`;
}

export function isOut(releaseDate: string, now = new Date()): boolean {
  return releaseDate <= today(now);
}

/** "14 March 2027", or "in 2027" style text when only the year or month is known. */
export function releaseLabel(releaseDate: string, published?: string | null): string {
  const [year, month, day] = releaseDate.split("-").map(Number);
  const precision = (published ?? releaseDate).length;
  if (precision === 4) return String(year);
  const options: Intl.DateTimeFormatOptions = precision === 7 ? { year: "numeric", month: "long" } : { dateStyle: "long" };
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Soonest first. */
export function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title));
}
