import { samplePageSentences } from "../data/sampleText";
import type { A11ySettings, Book, TranscriptLanguage } from "../types";
import { speakingParts } from "./narration";
import { chapterTimes, readerPages } from "./reading";

export const TRANSCRIPT_SIZES: { value: A11ySettings["transcriptSize"]; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

/** Each language's name in that language. */
export const TRANSCRIPT_LANGUAGES: { value: TranscriptLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

/** One sentence of the read-along transcript, timed in seconds from the start of the book. */
export interface TranscriptLine {
  text: string;
  start: number;
  end: number;
  /** True for the first sentence of a paragraph, so the transcript keeps the paragraphs. */
  opensParagraph: boolean;
}

/**
 * The chapter's read-along transcript: the same sample text as the reader's pages for that
 * chapter, spread over the chapter's listening time by the length of each English sentence
 * (so both languages change sentence at the same moment).
 */
export function chapterTranscript(book: Book, chapterIndex: number, language: TranscriptLanguage): TranscriptLine[] {
  const pages = readerPages(book).filter((p) => p.chapterIndex === chapterIndex);
  const english = pages.flatMap((p) => samplePageSentences(book.id, chapterIndex, p.page, "en"));
  const shown = language === "en" ? english : pages.flatMap((p) => samplePageSentences(book.id, chapterIndex, p.page, language));
  const weights = english.flat().map((s) => s.length);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  const { starts } = chapterTimes(book);
  const length = book.chapters[chapterIndex].minutes * 60;

  const lines: TranscriptLine[] = [];
  let at = starts[chapterIndex];
  let i = 0;
  shown.forEach((paragraph) => {
    paragraph.forEach((text, j) => {
      const duration = (weights[i] / totalWeight) * length;
      lines.push({ text, start: at, end: at + duration, opensParagraph: j === 0 });
      at += duration;
      i++;
    });
  });
  return lines;
}

/**
 * A chapter of real text as a transcript, for a device voice reading it: the same pieces the
 * voice speaks (speakingParts), timed the way the voice's clock runs (evenly by character over
 * the chapter's length), so the marked piece is the one being spoken.
 */
export function textTranscript(book: Book, chapterIndex: number, text: string): TranscriptLine[] {
  const parts = speakingParts(text);
  const last = parts[parts.length - 1];
  const size = last ? last.offset + last.text.length : 1;
  const start = chapterTimes(book).starts[chapterIndex];
  const length = book.chapters[chapterIndex].minutes * 60;
  // Where each paragraph starts once whitespace is collapsed, as speakingParts counts it.
  const opens = new Set<number>();
  let at = 0;
  for (const paragraph of text.split(/\n\s*\n/)) {
    opens.add(at);
    at += paragraph.replace(/\s+/g, " ").length + 1;
  }
  return parts.map((part) => ({
    text: part.text.trim(),
    start: start + (part.offset / size) * length,
    end: start + ((part.offset + part.text.length) / size) * length,
    opensParagraph: opens.has(part.offset),
  }));
}

/** The line being read at `seconds`, or -1 before the first. */
export function lineAt(lines: TranscriptLine[], seconds: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= seconds) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found;
}
