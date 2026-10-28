import type { Highlight, HighlightColor } from "../types";

/**
 * Where highlights sit on a reader page. A page's text is its paragraphs joined by a line
 * break; a highlight is a [start, end) range of characters in that text, which is also what
 * the `highlights` table stores.
 */

export const HIGHLIGHT_COLORS: { value: HighlightColor; label: string }[] = [
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "pink", label: "Pink" },
];

export const NOTE_MAX = 2000;
export const QUOTE_MAX = 2000;

/** Where each paragraph starts in the page's text. */
export function paragraphOffsets(paragraphs: string[]): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (const paragraph of paragraphs) {
    offsets.push(at);
    at += paragraph.length + 1;
  }
  return offsets;
}

export interface Segment {
  text: string;
  highlight: Highlight | null;
}

/**
 * Splits one paragraph into plain and highlighted runs. Where highlights overlap, the most
 * recent one shows.
 */
export function paragraphSegments(paragraph: string, offset: number, highlights: Highlight[]): Segment[] {
  const end = offset + paragraph.length;
  const here = highlights.filter((h) => h.start < end && h.end > offset);
  if (here.length === 0) return [{ text: paragraph, highlight: null }];
  const cuts = new Set([0, paragraph.length]);
  for (const h of here) {
    cuts.add(Math.max(0, h.start - offset));
    cuts.add(Math.min(paragraph.length, h.end - offset));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const covering = here
      .filter((h) => h.start - offset <= from && h.end - offset >= to)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const last = segments[segments.length - 1];
    if (last && last.highlight === (covering ?? null)) last.text += paragraph.slice(from, to);
    else segments.push({ text: paragraph.slice(from, to), highlight: covering ?? null });
  }
  return segments;
}

/** A selection on the page, as a range of the page's text, widened to whole words. */
export interface PageSelection {
  start: number;
  end: number;
  quote: string;
}

/** Characters from the start of `container` up to (node, offset), counting text only. */
function textBefore(container: Element, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * Turns the browser's selection into a range of the page's text. Each paragraph element
 * carries its start in `data-offset`. Returns null when the selection isn't inside the page's
 * paragraphs or holds no words.
 */
export function selectionOnPage(article: HTMLElement, range: Range, pageText: string): PageSelection | null {
  const paragraphOf = (node: Node) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const p = element?.closest<HTMLElement>("p[data-offset]");
    return p && article.contains(p) ? p : null;
  };
  const startP = paragraphOf(range.startContainer);
  const endP = paragraphOf(range.endContainer);
  if (!startP || !endP) return null;
  let start = Number(startP.dataset.offset) + textBefore(startP, range.startContainer, range.startOffset);
  let end = Number(endP.dataset.offset) + textBefore(endP, range.endContainer, range.endOffset);
  while (start < end && /\s/.test(pageText[start])) start++;
  while (end > start && /\s/.test(pageText[end - 1])) end--;
  // A drag that starts or stops inside a word takes the whole word, like an e-reader.
  const inWord = (i: number) => i >= 0 && i < pageText.length && /[\p{L}'’-]/u.test(pageText[i]);
  if (end > start) {
    while (inWord(start - 1) && inWord(start)) start--;
    while (inWord(end) && inWord(end - 1)) end++;
  }
  if (end <= start || end - start > QUOTE_MAX) return null;
  return { start, end, quote: pageText.slice(start, end).replace(/\n/g, " ") };
}

/** The selection as one dictionary word, or null when it's more than one word. */
export function singleWord(quote: string): string | null {
  const word = quote.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  return /^\p{L}+(?:['’-]\p{L}+)*$/u.test(word) && word.length <= 40 ? word : null;
}

/** "Chapter 3, page 2", for lists. */
export const highlightPlace = (h: Pick<Highlight, "chapterIndex" | "page">) => `Chapter ${h.chapterIndex + 1}, page ${h.page + 1}`;
