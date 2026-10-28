import { samplePageSentences } from "../data/sampleText";
import type { A11ySettings, Book, TranscriptLanguage } from "../types";
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
