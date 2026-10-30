import { books, isAllowed } from "../data/books";
import type { AgeRating, Book, RatingValue, ReadingStatus } from "../types";
import { normalizeQuery, QUERY_MAX, queryError } from "./search";

/**
 * Reading history from Goodreads or StoryGraph: their CSV exports, read in the browser (the
 * file never leaves the device; only titles are searched for, through the books function).
 * Each row becomes a title, an author, a shelf (as a reading status) and a rating, then is
 * matched to a LiteraryWorm title or a Google Books edition before anything is added.
 */

export type ImportSource = "goodreads" | "storygraph";

export interface ImportRow {
  /** The row's place in the file, for keys and messages. */
  line: number;
  title: string;
  author: string;
  status: ReadingStatus;
  rating: RatingValue | null;
}

export interface ImportFile {
  source: ImportSource;
  rows: ImportRow[];
  /** Rows left out: did-not-finish books, or rows with no title. */
  skipped: number;
}

/** The biggest file and the most books read in one go. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;

export const SOURCE_NAMES: Record<ImportSource, string> = { goodreads: "Goodreads", storygraph: "StoryGraph" };

/** Parses CSV (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** Which service made the file, from its header row. */
export function detectSource(header: string[]): ImportSource | null {
  const has = (name: string) => header.includes(name);
  if (has("Title") && has("Author") && has("Exclusive Shelf")) return "goodreads";
  if (has("Title") && has("Authors") && has("Read Status")) return "storygraph";
  return null;
}

const GOODREADS_SHELF: Record<string, ReadingStatus> = { read: "finished", "currently-reading": "reading", "to-read": "want_to_read" };
const STORYGRAPH_STATUS: Record<string, ReadingStatus | null> = {
  read: "finished",
  "currently-reading": "reading",
  paused: "reading",
  "to-read": "want_to_read",
  "did-not-finish": null,
};

/** Stars (0 = none; StoryGraph has quarter stars) as LiteraryWorm's three ratings. */
export function ratingFromStars(stars: number): RatingValue | null {
  if (!Number.isFinite(stars) || stars <= 0) return null;
  if (stars >= 4.5) return "love";
  return stars >= 3 ? "like" : "not-for-me";
}

/** Reads an export. Throws an Error with a message to show when the file isn't one. */
export function readImport(text: string): ImportFile {
  const [header, ...lines] = parseCsv(text);
  const source = header ? detectSource(header.map((h) => h.trim())) : null;
  if (!source) throw new Error("This doesn't look like a Goodreads or StoryGraph export. Choose the CSV file the site gave you.");
  if (lines.length > IMPORT_MAX_ROWS) throw new Error(`The file has ${lines.length} books. Import up to ${IMPORT_MAX_ROWS} at a time.`);
  const col = (name: string) => header.findIndex((h) => h.trim() === name);
  const title = col("Title");
  const author = col(source === "goodreads" ? "Author" : "Authors");
  const shelf = col(source === "goodreads" ? "Exclusive Shelf" : "Read Status");
  const stars = col(source === "goodreads" ? "My Rating" : "Star Rating");
  const rows: ImportRow[] = [];
  let skipped = 0;
  lines.forEach((cells, i) => {
    const t = (cells[title] ?? "").replace(/\s+/g, " ").trim();
    const shelfName = (cells[shelf] ?? "").trim().toLowerCase();
    const status = source === "goodreads" ? (GOODREADS_SHELF[shelfName] ?? "want_to_read") : STORYGRAPH_STATUS[shelfName] === undefined ? "want_to_read" : STORYGRAPH_STATUS[shelfName];
    if (!t || status === null) {
      skipped += 1;
      return;
    }
    rows.push({
      line: i + 2,
      title: t,
      // StoryGraph lists several authors separated by commas; the first is enough to match.
      author: (cells[author] ?? "").split(source === "storygraph" ? "," : /\n/)[0].replace(/\s+/g, " ").trim(),
      status,
      rating: ratingFromStars(Number(cells[stars])),
    });
  });
  return { source, rows, skipped };
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A title as search can take it: no series in brackets, no subtitle, only the characters search allows. */
export function searchTitle(title: string): string | null {
  const main = title
    .replace(/\s*\([^)]*\)\s*$/, "")
    .split(/:|\s[-–—]\s/)[0]
    .replace(/[^\p{L}\p{N}\p{M} '’.,!?&()-]/gu, " ");
  const q = normalizeQuery(main).slice(0, QUERY_MAX).trim();
  return q && !queryError(q) ? q : null;
}

const surname = (author: string) => fold(author).split(" ").filter(Boolean).at(-1) ?? "";

/**
 * True when `candidate` has the row's title and its author's surname. Both titles are compared
 * without series or subtitle ("Dune: Deluxe Edition" is Dune), and must then be the same
 * ("Dune Messiah" isn't).
 */
export function sameBook(row: Pick<ImportRow, "title" | "author">, candidate: { title: string; authors: string[] }): boolean {
  const wanted = fold(searchTitle(row.title) ?? row.title);
  const got = fold(searchTitle(candidate.title) ?? candidate.title);
  if (!wanted || got !== wanted) return false;
  const name = surname(row.author);
  return !name || candidate.authors.some((a) => fold(a).split(" ").includes(name));
}

/** The LiteraryWorm title the row is, if the profile may see it. */
export function catalogMatch(row: Pick<ImportRow, "title" | "author">, ageRating: AgeRating): Book | null {
  return books.find((b) => isAllowed(b.ageRating, ageRating) && sameBook(row, { title: b.title, authors: [b.author] })) ?? null;
}

/** The first search result that is the row's book, or null. */
export function pickMatch<T extends { title: string; authors: string[] }>(row: Pick<ImportRow, "title" | "author">, results: T[]): T | null {
  return results.find((r) => sameBook(row, r)) ?? null;
}

/** "Read" → what LiteraryWorm calls it. */
export const STATUS_LABEL: Record<ReadingStatus, string> = { want_to_read: "Want to read", reading: "Reading", finished: "Finished" };
