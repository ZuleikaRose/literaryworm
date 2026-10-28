import type { Book } from "../types";
import { chapterAt, CREDITS_SECONDS } from "./reading";

/**
 * Where the audiobook player's controls go, shared by the player page and the mini-player.
 * Times are seconds from the start of the book; `starts` comes from chapterTimes().
 */

/** A LibriVox chapter opens with its title and the LibriVox statement, and closes with "End of chapter…". */
const RECORDING_INTRO_SECONDS = 15;
const RECORDING_OUTRO_SECONDS = 5;
/** Previous chapter goes to the start of this one if it's been playing longer than this. */
const RESTART_CHAPTER_SECONDS = 3;
/** End of the book stops this far before the end, so the book isn't finished by a tap. */
export const END_LEAD_SECONDS = 30;

/** Seconds of spoken introduction at the start of a chapter (0 if none). */
export function chapterIntro(book: Book, index: number): number {
  const length = book.chapters[index].minutes * 60;
  const intro = book.recording ? RECORDING_INTRO_SECONDS : index === 0 ? CREDITS_SECONDS : 0;
  return Math.min(intro, length / 3);
}

/** Seconds of closing announcement at the end of a chapter (0 if none). */
export function chapterOutro(book: Book, index: number): number {
  const length = book.chapters[index].minutes * 60;
  const outro = book.recording ? RECORDING_OUTRO_SECONDS : index === book.chapters.length - 1 ? CREDITS_SECONDS : 0;
  return Math.min(outro, length / 3);
}

export interface PlayerPlaces {
  chapterIndex: number;
  chapterStart: number;
  chapterEnd: number;
  /** Where the intro ends, while it's playing; null otherwise. */
  introEnd: number | null;
  /** Where to go to skip the outro, while it's playing; null otherwise. */
  outroSkip: number | null;
  previousChapter: number | null;
  nextChapter: number | null;
  /** End of the book: a little before the end. */
  end: number;
}

/** Where each control goes from `position`. With `skipIntros`, chapter starts land after the intro. */
export function playerPlaces(book: Book, starts: number[], total: number, position: number, skipIntros: boolean): PlayerPlaces {
  const chapterIndex = chapterAt(starts, position);
  const last = book.chapters.length - 1;
  const chapterStart = starts[chapterIndex];
  const chapterEnd = chapterIndex === last ? total : starts[chapterIndex + 1];
  const intro = chapterIntro(book, chapterIndex);
  const outro = chapterOutro(book, chapterIndex);
  const startOf = (i: number) => starts[i] + (skipIntros ? chapterIntro(book, i) : 0);
  return {
    chapterIndex,
    chapterStart,
    chapterEnd,
    introEnd: intro > 0 && position < chapterStart + intro ? chapterStart + intro : null,
    // Skipping the last chapter's outro plays the book's final second, so it finishes as it would.
    outroSkip: outro > 0 && position >= chapterEnd - outro ? (chapterIndex === last ? total - 1 : startOf(chapterIndex + 1)) : null,
    previousChapter:
      position - startOf(chapterIndex) > RESTART_CHAPTER_SECONDS
        ? startOf(chapterIndex)
        : chapterIndex > 0
          ? startOf(chapterIndex - 1)
          : null,
    nextChapter: chapterIndex < last ? startOf(chapterIndex + 1) : null,
    end: Math.max(0, total - END_LEAD_SECONDS),
  };
}

/** Where the book starts: after the opening credits if intros are skipped. */
export const bookStart = (book: Book, skipIntros: boolean) => (skipIntros ? chapterIntro(book, 0) : 0);

/** "1:02:05", "62:05" or "45" → seconds; null if it isn't a time. */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const numbers = parts.map(Number);
  // Minutes and seconds after the first part are 0–59.
  if (numbers.slice(1).some((n) => n > 59)) return null;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

export interface IndexEntry {
  chapterIndex: number;
  /** Seconds from the start of the book where the words are read (approximate). */
  at: number;
  before: string;
  match: string;
  after: string;
}

const INDEX_MAX = 50;
const CONTEXT = 48;

/**
 * Every place `query` is read in the book (up to 50), from the chapters' text. A place in a
 * chapter's text maps to the same share of the chapter's time, as a device voice reads it.
 */
export function searchText(chapters: string[], starts: number[], lengths: number[], query: string): IndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const found: IndexEntry[] = [];
  chapters.forEach((raw, chapterIndex) => {
    const text = raw.replace(/\s+/g, " ");
    const haystack = text.toLowerCase();
    let from = 0;
    while (found.length < INDEX_MAX) {
      const i = haystack.indexOf(needle, from);
      if (i < 0) break;
      const start = Math.max(0, i - CONTEXT);
      const end = Math.min(text.length, i + needle.length + CONTEXT);
      found.push({
        chapterIndex,
        at: starts[chapterIndex] + (i / Math.max(1, text.length)) * lengths[chapterIndex],
        before: (start > 0 ? "…" : "") + text.slice(start, i),
        match: text.slice(i, i + needle.length),
        after: text.slice(i + needle.length, end) + (end < text.length ? "…" : ""),
      });
      from = i + needle.length;
    }
  });
  return found;
}
