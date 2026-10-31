import type { SavedWord } from "../types";
import type { DictionaryEntry } from "./dictionaryApi";

/**
 * My words: words a profile looked up in the dictionary and kept, with the sentence they came
 * from. The same limits as the `saved_words` table.
 */
export const WORDS_MAX = 500;
export const DEFINITION_MAX = 500;
export const CONTEXT_MAX = 400;

/** Where a looked-up word was met, when it came from a reader page. */
export interface WordSource {
  bookId: string;
  chapterIndex: number;
  page: number;
  context: string | null;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** The first sense the dictionary gives, as one line: "noun: a feeling of …". */
export function firstDefinition(entry: DictionaryEntry): string | null {
  const meaning = entry.meanings.find((m) => m.definitions.length > 0);
  if (!meaning) return null;
  return clip(`${meaning.partOfSpeech}: ${meaning.definitions[0].definition}`, DEFINITION_MAX);
}

/**
 * The sentence around [start, end) in a page's text (paragraphs joined by a line break): from
 * the last full stop, question or exclamation mark (or line break) before it to the next one.
 */
export function sentenceAround(text: string, start: number, end: number): string | null {
  if (start < 0 || end > text.length || start >= end) return null;
  const boundary = /[.!?\n]/;
  let from = start;
  while (from > 0 && !boundary.test(text[from - 1])) from--;
  let to = end;
  while (to < text.length && !boundary.test(text[to])) to++;
  if (to < text.length && text[to] !== "\n") to++;
  const sentence = text.slice(from, to).trim();
  return sentence ? clip(sentence, CONTEXT_MAX) : null;
}

export function hasWord(words: SavedWord[], word: string): boolean {
  return words.some((w) => w.word === word);
}

/** Practise: words not yet known first, the longest-kept first among them, then the known ones. */
export function practiceDeck(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => Number(a.learned) - Number(b.learned) || a.createdAt - b.createdAt);
}

/** "12 words, 4 known". */
export function wordsSummary(words: SavedWord[]): string {
  const known = words.filter((w) => w.learned).length;
  return `${words.length} word${words.length === 1 ? "" : "s"}${known ? `, ${known} known` : ""}`;
}
