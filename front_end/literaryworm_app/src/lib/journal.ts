import type { JournalEntry } from "../types";
import { activeLanguage, dateLocale, tr } from "./i18n";

/**
 * Reading journal: a profile's private, dated entries about a book, kept apart from the public
 * logs. The same limits as the `journal_entries` table.
 */
export const JOURNAL_BODY_MAX = 5000;
export const JOURNAL_MAX = 1000;

/** What's wrong with an entry, or null: the table's checks, in plain words. */
export function journalError(body: string, writtenOn: string, today: string): string | null {
  const text = body.trim();
  if (!text) return tr("Write something first.");
  if (text.length > JOURNAL_BODY_MAX) return tr("Keep an entry to {max} characters.", { max: JOURNAL_BODY_MAX.toLocaleString(dateLocale()) });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(writtenOn) || Number.isNaN(Date.parse(`${writtenOn}T00:00:00Z`))) return tr("Pick the day it's about.");
  if (writtenOn > today) return tr("Pick today or a day before.");
  return null;
}

/** A book's entries, the newest day first (the newest written first within a day). */
export function entriesFor(journal: JournalEntry[], bookId: string): JournalEntry[] {
  return journal.filter((e) => e.bookId === bookId).sort(byNewest);
}

export function byNewest(a: JournalEntry, b: JournalEntry): number {
  return b.writtenOn.localeCompare(a.writtenOn) || b.createdAt - a.createdAt;
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const dayFormat = () => {
  // English keeps the day-month order it has always had; other languages their own.
  const locale = activeLanguage() === "en" ? "en-GB" : dateLocale();
  let format = dayFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    dayFormats.set(locale, format);
  }
  return format;
};

/** "Sat, 31 October 2026" for a YYYY-MM-DD day, in the language chosen. */
export const journalDay = (day: string) => dayFormat().format(new Date(`${day}T00:00:00Z`));
