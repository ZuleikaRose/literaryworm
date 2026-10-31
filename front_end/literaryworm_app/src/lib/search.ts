import { books, isAllowed } from "../data/books";
import { type BrowseGenre, isBrowseGenre, sampleCatalogGenres } from "../data/genres";
import type { AgeRating, Book } from "../types";

/**
 * Search is by title (the brief), or by author or ISBN when the reader chooses. These match the
 * `books` Edge Function's own checks, which are the same for a title and an author's name.
 */
export const QUERY_MAX = 100;
const QUERY_CHARS = /^[\p{L}\p{N}\p{M} '’.,!?&()-]+$/u;

export type SearchSort = "relevance" | "newest";
/** What the words are matched against: titles (the default), authors' names, or an ISBN. */
export type SearchBy = "title" | "author" | "isbn";
export type SearchSource = "all" | "literaryworm" | "google";

/** The languages search offers (ISO 639-1, the same list as the `books` function's `lang`). */
export const SEARCH_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
] as const;
export type SearchLanguage = (typeof SEARCH_LANGUAGES)[number]["code"];

/** Length by page count. Google Books has no such filter, so results are checked here. */
export const SEARCH_LENGTHS = [
  { id: "short", label: "Under 200 pages", min: 1, max: 199 },
  { id: "medium", label: "200 to 400 pages", min: 200, max: 400 },
  { id: "long", label: "Over 400 pages", min: 401, max: Infinity },
] as const;
export type SearchLength = (typeof SEARCH_LENGTHS)[number]["id"];

export interface SearchParams {
  q: string;
  /**
   * Title unless `by=author` or `by=isbn` is in the address. An author search has no genre,
   * language or sort; an ISBN search has no filters at all, and `q` is the ISBN's digits.
   */
  by: SearchBy;
  genre: BrowseGenre | null;
  sort: SearchSort;
  source: SearchSource;
  lang: SearchLanguage | null;
  length: SearchLength | null;
}

const isLanguage = (v: string | null): v is SearchLanguage => SEARCH_LANGUAGES.some((l) => l.code === v);
const isLength = (v: string | null): v is SearchLength => SEARCH_LENGTHS.some((l) => l.id === v);

/** True when a book of this many pages fits the length filter; unknown lengths never do. */
export function fitsLength(pages: number | null | undefined, length: SearchLength | null): boolean {
  if (!length) return true;
  if (!pages) return false;
  const band = SEARCH_LENGTHS.find((l) => l.id === length)!;
  return pages >= band.min && pages <= band.max;
}

/** The catalog's language names, as search's codes. */
export function languageCode(name: string): string {
  return SEARCH_LANGUAGES.find((l) => l.label === name)?.code ?? name.toLowerCase();
}

export function normalizeQuery(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * An ISBN-10 or ISBN-13 as its digits (spaces and hyphens dropped, a final x as X), or null when
 * it isn't one or its check digit is wrong. The same rule as the `books` function's `parseIsbn()`.
 */
export function cleanIsbn(raw: string): string | null {
  const isbn = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, c, i) => total + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? isbn : null;
  }
  if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((total, c, i) => total + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0 ? isbn : null;
  }
  return null;
}

/** A plain-words problem with the query, or null when it can be searched. */
export function queryError(q: string, by: SearchBy = "title"): string | null {
  if (by === "isbn") {
    if (!q) return "Enter an ISBN to search for.";
    const digits = q.replace(/[\s-]/g, "");
    if (!/^[\dXx]+$/.test(digits)) return "An ISBN is made of digits (the last can be X). Spaces and hyphens are fine.";
    if (digits.length !== 10 && digits.length !== 13) return `An ISBN has 10 or 13 digits. This one has ${digits.length}.`;
    if (!cleanIsbn(q)) return "That ISBN doesn't add up. Check each digit against the book.";
    return null;
  }
  const what = by === "author" ? "an author's name" : "a title";
  if (!q) return `Enter ${what} to search for.`;
  if (q.length > QUERY_MAX) return `Search is limited to ${QUERY_MAX} characters. Try a shorter ${by === "author" ? "name" : "title"}.`;
  if (!QUERY_CHARS.test(q)) return `Search by ${by} using letters, numbers and basic punctuation.`;
  return null;
}

/** The search with nothing narrowing it: no genre, language or length, sorted by relevance, from everywhere. */
export const unfiltered = (q: string, by: SearchBy = "title"): SearchParams => ({
  q,
  by,
  genre: null,
  sort: "relevance",
  source: "all",
  lang: null,
  length: null,
});

/** Read the search from the URL, falling back to defaults for anything unexpected. */
export function readSearchParams(params: URLSearchParams): SearchParams {
  const genre = params.get("genre");
  const sort = params.get("sort");
  const source = params.get("source");
  const byParam = params.get("by");
  const by: SearchBy = byParam === "author" || byParam === "isbn" ? byParam : "title";
  const q = normalizeQuery(params.get("q") ?? "");
  // An ISBN names one book (in its editions), so there's nothing to narrow, and only Google
  // Books knows ISBNs.
  if (by === "isbn") return { ...unfiltered(cleanIsbn(q) ?? q, by), source: "google" };
  // Google's author search can't narrow by genre or language, or sort by date, so neither does ours.
  const byTitle = by === "title";
  return {
    q,
    by,
    genre: byTitle && isBrowseGenre(genre) ? genre : null,
    sort: byTitle && sort === "newest" ? "newest" : "relevance",
    source: source === "literaryworm" || source === "google" ? source : "all",
    lang: byTitle && isLanguage(params.get("lang")) ? (params.get("lang") as SearchLanguage) : null,
    length: isLength(params.get("length")) ? (params.get("length") as SearchLength) : null,
  };
}

export function searchUrl({ q, by, genre, sort, source, lang, length }: SearchParams): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (by !== "title") params.set("by", by);
  if (genre) params.set("genre", genre);
  if (sort !== "relevance") params.set("sort", sort);
  if (source !== "all" && by !== "isbn") params.set("source", source);
  if (lang) params.set("lang", lang);
  if (length) params.set("length", length);
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

/** True when every word of the query starts a word of the text (like Google's intitle: per word). */
export function wordsMatch(text: string, q: string): boolean {
  const words = fold(text).split(" ");
  return fold(q)
    .split(" ")
    .filter(Boolean)
    .every((w) => words.some((t) => t.startsWith(w)));
}

/** LiteraryWorm's own titles that match, filtered and sorted like the Google results. */
export function catalogMatches({ q, by, genre, sort, lang, length }: SearchParams, ageRating: AgeRating): Book[] {
  // The catalog doesn't keep ISBNs.
  if (by === "isbn") return [];
  const found = books.filter(
    (b) =>
      isAllowed(b.ageRating, ageRating) &&
      wordsMatch(by === "author" ? b.author : b.title, q) &&
      (!genre || b.genres.some((g) => sampleCatalogGenres[genre].includes(g))) &&
      (!lang || languageCode(b.language) === lang) &&
      fitsLength(b.pages, length),
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
  if (!changed || !visible.some((b) => wordsMatch(b.title, corrected))) return null;
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
