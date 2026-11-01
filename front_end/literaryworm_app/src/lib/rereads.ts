import type { LibraryEntry, ReadingDay } from "../types";

/**
 * Rereads, worked out from a profile's reading days (each day keeps the books finished on it), so
 * nothing new is stored: a book finished on two days was read twice. *Read again* on the book page
 * moves a finished book back to Reading and its place to the start; finishing it again adds a day.
 * Imported books count once (their finish days aren't known) when they're marked Finished.
 */

/** The days (YYYY-MM-DD, oldest first) a book was finished. */
export function finishDays(readingDays: Record<string, Pick<ReadingDay, "books">>, bookId: string): string[] {
  return Object.entries(readingDays)
    .filter(([, d]) => d.books?.includes(bookId))
    .map(([day]) => day)
    .sort();
}

/** How many times the book has been read to the end: the finish days, or 1 for a Finished book with none known. */
export function timesRead(entry: Pick<LibraryEntry, "status"> | undefined, days: string[]): number {
  if (days.length > 0) return days.length;
  return entry?.status === "finished" ? 1 : 0;
}

/** True while a book read before is being read again. */
export const isRereading = (entry: Pick<LibraryEntry, "status"> | undefined, days: string[]) =>
  entry?.status === "reading" && days.length > 0;

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st… */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Read twice", "Read 3 times"; empty when read once or never (nothing to say). */
export function timesReadLabel(times: number): string {
  if (times < 2) return "";
  return times === 2 ? "Read twice" : `Read ${times} times`;
}

/** What the book page says about a book's reads: "Your 2nd read" while rereading, else "Read twice". */
export function readsLine(entry: Pick<LibraryEntry, "status"> | undefined, days: string[]): string {
  if (isRereading(entry, days)) return `Your ${ordinal(days.length + 1)} read`;
  return timesReadLabel(timesRead(entry, days));
}
