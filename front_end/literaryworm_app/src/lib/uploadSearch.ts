import type { UploadedBook } from "../types";
import type { ReaderPage } from "./reading";
import { normalizeQuery, wordsMatch } from "./search";

/**
 * Searching a profile's uploaded EPUBs (My Library → Uploads): by title or author, which is
 * checked as the reader types; by ISBN, which Google Books names (uploads keep no ISBNs, so its
 * editions are matched by title and author, as when starting a club); or by keywords, which also looks through each book's text and
 * names the places they're found. Everything happens in the browser; the words aren't sent anywhere.
 */
export type UploadSearchBy = "title" | "author" | "keywords" | "isbn";

export const UPLOAD_SEARCH_BY: { value: UploadSearchBy; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "keywords", label: "Keywords" },
  { value: "isbn", label: "ISBN" },
];

/** Places shown for each book; the count says how many more there are. */
export const HITS_PER_BOOK = 3;
/** Characters of text either side of a match. */
const CONTEXT = 60;
export const UPLOAD_QUERY_MAX = 100;

export interface TextHit {
  chapterIndex: number;
  /** 0-based page within the chapter, as the reader pages it (`textPages()`). */
  page: number;
  before: string;
  match: string;
  after: string;
}

export interface KeywordResult {
  hits: TextHit[];
  /** Every place the words were found in the text (hits holds the first few). */
  count: number;
}

/** The words of a query, without repeats, longest first (so "the" doesn't hide "theory"). */
export function queryWords(q: string): string[] {
  const words = normalizeQuery(q)
    .toLowerCase()
    .split(" ")
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  return [...new Set(words)].sort((a, b) => b.length - a.length);
}

/** A problem with the query in plain words, or null. */
export function uploadQueryError(q: string): string | null {
  const clean = normalizeQuery(q);
  if (!clean) return "Enter a word or two to search for.";
  if (clean.length > UPLOAD_QUERY_MAX) return `Search is limited to ${UPLOAD_QUERY_MAX} characters. Try fewer words.`;
  if (queryWords(clean).length === 0) return "Search using letters or numbers.";
  return null;
}

/** What a keyword search looks through besides the text: the title, author and part names. */
export function uploadDetails(u: Pick<UploadedBook, "title" | "author" | "chapterTitles">): string {
  return [u.title, u.author, ...u.chapterTitles].join(" ");
}

/** Whether an upload's title or author (or, for keywords, its details) has every word typed. */
export function detailsMatch(u: Pick<UploadedBook, "title" | "author" | "chapterTitles">, q: string, by: UploadSearchBy): boolean {
  if (!normalizeQuery(q)) return true;
  // An ISBN is matched through Google Books by the caller (`isbnMatches()`), never here.
  if (by === "isbn") return true;
  const text = by === "title" ? u.title : by === "author" ? u.author : uploadDetails(u);
  return wordsMatch(text, q);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each word found from the start of a word, in any case. */
function wordPattern(words: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escape).join("|")})`, "giu");
}

/**
 * The places in a book's pages where any of the words starts a word, when every word is found
 * somewhere in the text or the book's details; otherwise null. Pages are the reader's own, so
 * each place links straight to its page.
 */
export function searchPages(
  pages: ReaderPage[],
  q: string,
  details = "",
): KeywordResult | null {
  const words = queryWords(q);
  if (words.length === 0) return null;
  const pattern = wordPattern(words);
  const seen = new Set<string>();
  const hits: TextHit[] = [];
  let count = 0;
  for (const p of pages) {
    const text = (p.paragraphs ?? []).join(" ").replace(/\s+/g, " ");
    for (const m of text.matchAll(pattern)) {
      // The pattern matches only the words themselves, longest first.
      const found = m[0];
      seen.add(found.toLowerCase());
      count += 1;
      if (hits.length < HITS_PER_BOOK) {
        const i = m.index ?? 0;
        const start = Math.max(0, i - CONTEXT);
        const end = Math.min(text.length, i + found.length + CONTEXT);
        hits.push({
          chapterIndex: p.chapterIndex,
          page: p.page,
          before: (start > 0 ? "…" : "") + text.slice(start, i),
          match: text.slice(i, i + found.length),
          after: text.slice(i + found.length, end) + (end < text.length ? "…" : ""),
        });
      }
    }
  }
  const everyWord = words.every((w) => seen.has(w) || wordsMatch(details, w));
  return everyWord ? { hits, count } : null;
}

/** The reader's address for a place found in an upload. */
export function hitPath(bookId: string, hit: Pick<TextHit, "chapterIndex" | "page">): string {
  return `/read/${bookId}?chapter=${hit.chapterIndex}&page=${hit.page}`;
}
