import { books, isAllowed } from "../data/books";
import { type BrowseGenre, isBrowseGenre, sampleCatalogGenres } from "../data/genres";
import type { AgeRating, Book } from "../types";

/** Search is by title only (the brief). These match the `books` Edge Function's own checks. */
export const QUERY_MAX = 100;
const QUERY_CHARS = /^[\p{L}\p{N}\p{M} '’.,!?&()-]+$/u;

export type SearchSort = "relevance" | "newest";
export type SearchSource = "all" | "literaryworm" | "google";

export interface SearchParams {
  q: string;
  genre: BrowseGenre | null;
  sort: SearchSort;
  source: SearchSource;
}

export function normalizeQuery(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** A plain-words problem with the query, or null when it can be searched. */
export function queryError(q: string): string | null {
  if (!q) return "Enter a title to search for.";
  if (q.length > QUERY_MAX) return `Search is limited to ${QUERY_MAX} characters. Try a shorter title.`;
  if (!QUERY_CHARS.test(q)) return "Search by title using letters, numbers and basic punctuation.";
  return null;
}

/** Read the search from the URL, falling back to defaults for anything unexpected. */
export function readSearchParams(params: URLSearchParams): SearchParams {
  const genre = params.get("genre");
  const sort = params.get("sort");
  const source = params.get("source");
  return {
    q: normalizeQuery(params.get("q") ?? ""),
    genre: isBrowseGenre(genre) ? genre : null,
    sort: sort === "newest" ? "newest" : "relevance",
    source: source === "literaryworm" || source === "google" ? source : "all",
  };
}

export function searchUrl({ q, genre, sort, source }: SearchParams): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  if (sort !== "relevance") params.set("sort", sort);
  if (source !== "all") params.set("source", source);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when every word of the query appears in the title (like Google's intitle: per word). */
function titleMatches(title: string, q: string): boolean {
  const words = fold(title).split(" ");
  return fold(q)
    .split(" ")
    .filter(Boolean)
    .every((w) => words.some((t) => t.startsWith(w)));
}

/** LiteraryWorm's own titles that match, filtered and sorted like the Google results. */
export function catalogMatches({ q, genre, sort }: SearchParams, ageRating: AgeRating): Book[] {
  const found = books.filter(
    (b) =>
      isAllowed(b.ageRating, ageRating) &&
      titleMatches(b.title, q) &&
      (!genre || b.genres.some((g) => sampleCatalogGenres[genre].includes(g))),
  );
  return sort === "newest" ? found.sort((a, b) => b.year - a.year) : found;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

/**
 * "Did you mean …?" for a query that found nothing: each word the catalog's titles don't
 * use is swapped for the closest title word, when it's close enough to be a likely typo
 * ("midnite libary" → "midnight library"). Suggested only if the corrected search finds a
 * title the profile may see.
 */
export function didYouMean(q: string, ageRating: AgeRating): string | null {
  const visible = books.filter((b) => isAllowed(b.ageRating, ageRating));
  // Folded word → how titles write it ("midnight" → "Midnight"), to show the suggestion nicely.
  const display = new Map<string, string>();
  for (const book of visible) {
    for (const word of book.title.split(/\s+/)) {
      const key = fold(word);
      if (key.length > 1 && !display.has(key)) display.set(key, word.replace(/[^\p{L}\p{N}'’-]/gu, ""));
    }
  }
  const vocabulary = new Set(display.keys());
  let changed = false;
  const corrected = fold(q)
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length < 3 || vocabulary.has(word)) return word;
      let best: { word: string; score: number } | null = null;
      for (const candidate of vocabulary) {
        const score = distance(word, candidate) / Math.max(word.length, candidate.length);
        if (score <= 0.4 && (!best || score < best.score)) best = { word: candidate, score };
      }
      if (best) changed = true;
      return best?.word ?? word;
    })
    .join(" ");
  if (!changed || !visible.some((b) => titleMatches(b.title, corrected))) return null;
  return corrected
    .split(" ")
    .map((word) => display.get(word) ?? word)
    .join(" ");
}

/** A random catalog title the profile may see (Surprise Me). */
export function surpriseBook(ageRating: AgeRating, exclude?: string): Book {
  const pool = books.filter((b) => isAllowed(b.ageRating, ageRating) && b.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
