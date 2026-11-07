/**
 * Read-along in the reader (components/ReaderReadAloud.tsx): while a natural voice reads an upload,
 * the word being spoken is marked on the reader's own page and the pages turn with it. The voice's
 * clock runs evenly by character over a chapter (as the player's transcript times it), so the word
 * is found by its share of the chapter's letters, then placed on a page by counting words, which
 * doesn't depend on how the pages break paragraphs. Worked out in the browser.
 */

const words = (text: string) => [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));

/** The word (its index in the chapter) being spoken `share` (0–1) of the way through the chapter, or -1 with no words. */
export function spokenWordIndex(chapterText: string, share: number): number {
  const text = chapterText.replace(/\s+/g, " ");
  const list = words(text);
  if (!list.length) return -1;
  const at = Math.min(1, Math.max(0, share)) * text.length;
  const found = list.findIndex((w) => at < w.end);
  return found === -1 ? list.length - 1 : found;
}

/** The share (0–1) of the chapter at which word `k` starts, for starting the voice there. */
export function shareOfWord(chapterText: string, k: number): number {
  const text = chapterText.replace(/\s+/g, " ");
  const list = words(text);
  if (!list.length || !text.length) return 0;
  const word = list[Math.max(0, Math.min(list.length - 1, k))];
  return word.start / text.length;
}

/** How many words a page has (counted the same way). */
export const pageWordCount = (pageText: string) => words(pageText).length;

/** Which of a chapter's pages (by their word counts, in order) has word `k`, and which word of that page it is. */
export function placeOfWord(pageWordCounts: number[], k: number): { page: number; word: number } | null {
  if (k < 0) return null;
  let before = 0;
  for (let page = 0; page < pageWordCounts.length; page++) {
    if (k < before + pageWordCounts[page]) return { page, word: k - before };
    before += pageWordCounts[page];
  }
  return null;
}

/** Word `n` of a page's text, as character offsets. */
export function nthWord(pageText: string, n: number): { start: number; end: number } | null {
  return words(pageText)[n] ?? null;
}
