// True read-along for LibriVox recordings (ALIGNED_BOOKS). scripts/align-librivox.py lines a
// recording up with the book's own text once, ahead of time, and writes public/alignments/<id>.json:
// for each chapter (one recording track), anchors of [word index in the chapter's text, seconds into
// the track], about every ten matched words. Words are the chapter text split on whitespace, the same
// way here and in the script (JS_WHITESPACE there), so the indexes agree. The transcript times each
// sentence (speakingParts) from the anchors around its first word.

import type { Book } from "../types";
import { speakingParts } from "./speaking";
import { chapterTimes } from "./reading";
import type { TranscriptLine } from "./transcript";

/** The books with an alignment file. */
export const ALIGNED_BOOKS = [
  "frankenstein",
  "pride-and-prejudice",
  "alice-in-wonderland",
  "through-the-looking-glass",
  "a-christmas-carol",
  "the-wonderful-wizard-of-oz",
  "dr-jekyll-and-mr-hyde",
  "the-call-of-the-wild",
] as const;

export const isAligned = (bookId: string): boolean => (ALIGNED_BOOKS as readonly string[]).includes(bookId);

/** [word index in the chapter text, seconds into its track], in order of both. */
export type Anchor = [number, number];

export interface Alignment {
  /** One list of anchors per chapter (track); an empty list where a chapter couldn't be aligned. */
  chapters: Anchor[][];
}

/** Checks a downloaded alignment file: right shape, anchors moving forward in words and time. */
export function parseAlignment(raw: unknown, chapterCount: number): Alignment | null {
  if (!raw || typeof raw !== "object") return null;
  const chapters = (raw as { chapters?: unknown }).chapters;
  if (!Array.isArray(chapters) || chapters.length !== chapterCount) return null;
  const out: Anchor[][] = [];
  for (const list of chapters) {
    if (!Array.isArray(list)) return null;
    const anchors: Anchor[] = [];
    for (const a of list) {
      if (!Array.isArray(a) || a.length !== 2 || !Number.isInteger(a[0]) || typeof a[1] !== "number" || a[0] < 0 || a[1] < 0) return null;
      const prev = anchors[anchors.length - 1];
      // Out-of-order anchors are dropped rather than trusted.
      if (prev && (a[0] <= prev[0] || a[1] < prev[1])) continue;
      anchors.push([a[0], a[1]]);
    }
    out.push(anchors);
  }
  return { chapters: out };
}

/** Seconds into the track at which word `index` is read: between the anchors around it, in proportion. */
export function wordTime(anchors: Anchor[], index: number): number {
  if (!anchors.length) return 0;
  if (index <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (index >= last[0]) return last[1];
  let low = 0;
  let high = anchors.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (anchors[mid][0] <= index) low = mid;
    else high = mid;
  }
  const [w0, t0] = anchors[low];
  const [w1, t1] = anchors[high];
  return t0 + ((index - w0) / (w1 - w0)) * (t1 - t0);
}

/** How many words come before `offset` in the whitespace-collapsed text speakingParts() uses. */
export function wordsBefore(collapsed: string, offset: number): number {
  return collapsed.slice(0, offset).split(" ").filter(Boolean).length;
}

/**
 * A chapter of the book's own text as a transcript timed to the real recording: each sentence starts
 * when its first word is read (from the alignment) and ends when the next starts; the last runs to
 * the chapter's end. Null when the chapter has no anchors, so the caller can fall back.
 */
export function alignedTranscript(book: Book, chapterIndex: number, text: string, anchors: Anchor[]): TranscriptLine[] | null {
  if (anchors.length < 2) return null;
  const parts = speakingParts(text);
  if (!parts.length) return null;
  const collapsed = text.replace(/\s+/g, " ");
  const { starts } = chapterTimes(book);
  const chapterStart = starts[chapterIndex];
  const chapterEnd = chapterStart + book.chapters[chapterIndex].minutes * 60;
  const opens = new Set<number>();
  let at = 0;
  for (const paragraph of text.split(/\n\s*\n/)) {
    opens.add(at);
    at += paragraph.replace(/\s+/g, " ").length + 1;
  }
  const begins = parts.map((p) => chapterStart + wordTime(anchors, wordsBefore(collapsed, p.offset)));
  return parts.map((part, i) => ({
    text: part.text.trim(),
    start: begins[i],
    end: Math.max(begins[i], i + 1 < begins.length ? begins[i + 1] : chapterEnd),
    opensParagraph: opens.has(part.offset),
  }));
}
