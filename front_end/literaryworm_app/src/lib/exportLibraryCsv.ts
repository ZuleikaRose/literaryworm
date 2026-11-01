import type { BookMood, RatingValue, ReadingStatus } from "../types";

/**
 * Library export as CSV, in Goodreads' and StoryGraph's own export layouts, so either site's
 * importer takes it (and so does ours, lib/importCsv.ts). Made in the browser and downloaded, never
 * uploaded. LiteraryWorm keeps no ISBNs, so those columns are empty and the sites match by title
 * and author. Ratings become stars the way the importer reads them back (`ratingFromStars()`).
 */
export type ExportFormat = "goodreads" | "storygraph";

export interface ExportBook {
  bookId: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  /** When it was added to the library (ms). */
  addedAt: number;
  /** The day it was finished (YYYY-MM-DD), when known. */
  finishedOn: string | null;
  /** Every day it was finished here, oldest first (rereads, lib/rereads.ts), when known. */
  readDays?: string[];
  pages: number | null;
  year: number | null;
  rating: RatingValue | null;
  /** Moods and pace the profile tagged (lib/moods.ts), for StoryGraph's Moods and Pace columns. */
  mood?: BookMood | null;
}

export const STARS: Record<RatingValue, number> = { love: 5, like: 4, "not-for-me": 2 };

const SHELF: Record<ReadingStatus, string> = { finished: "read", reading: "currently-reading", want_to_read: "to-read", did_not_finish: "did-not-finish" };

/** A CSV cell: quoted when it needs to be; a leading =, + or @ is kept as text so spreadsheets don't run it as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");

/** 2026-11-01 (or ms) as 2026/11/01, the way both sites write dates. */
function slashDate(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "string") return value.replace(/-/g, "/");
  const d = new Date(value);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/** Words that belong with the surname that follows them ("Le Guin", "de Beauvoir", "van Gogh"). */
const PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "du", "la", "le", "st.", "van", "von"]);

/** "Le Guin, Ursula K." from "Ursula K. Le Guin" (Goodreads' "Author l-f"): the surname first. */
export function lastFirst(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase())) start--;
  return `${parts.slice(start).join(" ")}, ${parts.slice(0, start).join(" ")}`;
}

export const GOODREADS_HEADER = [
  "Book Id", "Title", "Author", "Author l-f", "Additional Authors", "ISBN", "ISBN13", "My Rating", "Average Rating", "Publisher", "Binding",
  "Number of Pages", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Bookshelves", "Bookshelves with positions",
  "Exclusive Shelf", "My Review", "Spoiler", "Private Notes", "Read Count", "Owned Copies",
];

export const STORYGRAPH_HEADER = [
  "Title", "Authors", "Contributors", "ISBN/UID", "Format", "Read Status", "Date Added", "Last Date Read", "Dates Read", "Read Count", "Moods",
  "Pace", "Character- or Plot-Driven?", "Strong Character Development?", "Loveable Characters?", "Diverse Characters?", "Flawed Characters?",
  "Star Rating", "Review", "Content Warnings", "Content Warning Description", "Tags", "Owned?",
];

/** Read Count: the finish days, else 1 for a Finished book. */
const readCount = (b: ExportBook) => Math.max(b.readDays?.length ?? 0, b.status === "finished" ? 1 : 0);

/** StoryGraph's Dates Read: each read as a day range, comma-separated ("2025/01/10-2025/01/10, 2026/03/02-2026/03/02"). */
const datesRead = (b: ExportBook) =>
  b.readDays?.length ? b.readDays.map((d) => `${slashDate(d)}-${slashDate(d)}`).join(", ") : b.status === "finished" && b.finishedOn ? slashDate(b.finishedOn) : "";

export function toCsv(books: ExportBook[], format: ExportFormat): string {
  const lines =
    format === "goodreads"
      ? [
          row(GOODREADS_HEADER),
          ...books.map((b) => {
            const shelf = SHELF[b.status];
            return row([
              "", b.title, b.authors[0] ?? "", b.authors[0] ? lastFirst(b.authors[0]) : "", b.authors.slice(1).join(", "), "", "",
              b.rating ? STARS[b.rating] : 0, "", "", "", b.pages, b.year, b.year, b.status === "finished" ? slashDate(b.finishedOn) : "",
              slashDate(b.addedAt), "", "", shelf, "", "", "", readCount(b), 0,
            ]);
          }),
        ]
      : [
          row(STORYGRAPH_HEADER),
          ...books.map((b) =>
            row([
              b.title, b.authors.join(", "), "", "", "digital", SHELF[b.status], slashDate(b.addedAt), b.status === "finished" ? slashDate(b.finishedOn) : "",
              datesRead(b), readCount(b), b.mood?.moods.join(", ") ?? "", b.mood?.pace ?? "", "", "", "", "", "",
              b.rating ? STARS[b.rating].toFixed(1) : "", "", "", "", "", "No",
            ]),
          ),
        ];
  // CRLF, as spreadsheets expect; a byte-order mark so Excel reads accents correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** literaryworm-goodreads-2026-11-01.csv */
export const exportCsvName = (format: ExportFormat, day: string) => `literaryworm-${format}-${day}.csv`;

/** Saves the CSV as a file in the browser (nothing is uploaded). */
export function downloadCsv(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The day each book was last finished, from a profile's reading days (YYYY-MM-DD → finished ids). */
export function lastFinished(readingDays: Record<string, { books?: string[] }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [day, d] of Object.entries(readingDays)) for (const id of d.books ?? []) if (!out[id] || out[id] < day) out[id] = day;
  return out;
}
