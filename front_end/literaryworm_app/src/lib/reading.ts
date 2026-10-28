import type { Book, ReaderSettings } from "../types";

/** Positions in a book, for the reader (pages) and the player (seconds). */

export interface ReaderPage {
  chapterIndex: number;
  /** 0-based page within the chapter. */
  page: number;
  /** The page's paragraphs, for a book with real text; sample pages make theirs from the position. */
  paragraphs?: string[];
}

/** Characters on a page of real text: about a phone screen at the default size. */
export const PAGE_CHARS = 1600;

/** A paragraph too long for one page, cut between sentences (a sentence longer than a page stays whole). */
function pieces(paragraph: string): string[] {
  if (paragraph.length <= PAGE_CHARS) return [paragraph];
  const sentences = paragraph.match(/[^.!?]*[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > PAGE_CHARS) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Pages of a book's real text (one string per chapter, paragraphs separated by a blank line):
 * whole paragraphs, filled up to about PAGE_CHARS. The same text always makes the same pages,
 * which highlights rely on.
 */
export function textPages(chapters: string[]): ReaderPage[] {
  return chapters.flatMap((text, chapterIndex) => {
    const pages: string[][] = [];
    let current: string[] = [];
    let length = 0;
    for (const paragraph of text.split("\n\n").flatMap(pieces)) {
      if (current.length > 0 && length + paragraph.length > PAGE_CHARS) {
        pages.push(current);
        current = [];
        length = 0;
      }
      current.push(paragraph);
      length += paragraph.length;
    }
    if (current.length > 0 || pages.length === 0) pages.push(current);
    return pages.map((paragraphs, page) => ({ chapterIndex, page, paragraphs }));
  });
}

/** Pages per chapter in the sample text: about one page per six minutes of listening, 3 to 8. */
export function readerPages(book: Book): ReaderPage[] {
  return book.chapters.flatMap((chapter, chapterIndex) => {
    const count = Math.min(8, Math.max(3, Math.round(chapter.minutes / 6)));
    return Array.from({ length: count }, (_, page) => ({ chapterIndex, page }));
  });
}

/** The first page index of each chapter. */
export function chapterStarts(pages: ReaderPage[]): number[] {
  const starts: number[] = [];
  pages.forEach((p, i) => {
    if (p.page === 0) starts[p.chapterIndex] = i;
  });
  return starts;
}

/** Page index → fraction of the book read (0 on the first page). */
export const pageFraction = (index: number, total: number) => (total > 0 ? index / total : 0);

/** Fraction → page index, clamped to the book. */
export const pageForFraction = (fraction: number, total: number) =>
  Math.min(total - 1, Math.max(0, Math.round(fraction * total)));

/** Start of each chapter in seconds, plus the book's total length. */
export function chapterTimes(book: Book): { starts: number[]; total: number } {
  const starts: number[] = [];
  let total = 0;
  for (const chapter of book.chapters) {
    starts.push(total);
    total += chapter.minutes * 60;
  }
  return { starts, total };
}

/** The chapter playing at `seconds`. */
export function chapterAt(starts: number[], seconds: number): number {
  let index = 0;
  starts.forEach((start, i) => {
    if (seconds >= start) index = i;
  });
  return index;
}

/** "Chapter 3 of 12: The Hall", or just "Chapter 3 of 12" when the chapter has no name of its own. */
export function chapterLabel(book: Book, index: number): string {
  const base = `Chapter ${index + 1} of ${book.chapters.length}`;
  const title = book.chapters[index].title;
  return title === `Chapter ${index + 1}` ? base : `${base}: ${title}`;
}

/** 3725 → "1:02:05"; 65 → "1:05". */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 3725 → "1 hour 2 minutes", for screen readers. */
export function spokenTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const SKIP_SECONDS = 15;
/** Opening and closing credits in the sample audiobooks. */
export const CREDITS_SECONDS = 30;

export type SleepTimer = { kind: "minutes"; minutes: number } | { kind: "chapter" } | null;
export const SLEEP_MINUTES = [5, 15, 30, 45, 60];

export const READER_SIZES = [16, 18, 20, 23, 26, 30];

export const defaultReaderSettings: ReaderSettings = {
  font: "serif",
  size: 2,
  spacing: "normal",
  margins: "normal",
  theme: "sepia",
};

/**
 * What removing a book from the library also deletes, as one sentence, or null when there's
 * nothing to lose (so the page can skip asking).
 */
export function lostWithBook(logs: number, hasPlace: boolean, bookmarks: number, highlights = 0): string | null {
  const parts = [
    logs > 0 && (logs === 1 ? "your log" : `your ${logs} logs`),
    hasPlace && "your place in the book",
    bookmarks > 0 && (bookmarks === 1 ? "your bookmark" : `your ${bookmarks} bookmarks`),
    highlights > 0 && (highlights === 1 ? "your highlight" : `your ${highlights} highlights and notes`),
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list[0].toUpperCase()}${list.slice(1)} will be deleted too. This can't be undone.`;
}

/** Today's date in the device's time zone, for the daily limit. */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
