import { books, isAllowed } from "../data/books";
import { type BrowseGenre, sampleCatalogGenres } from "../data/genres";
import type { AgeRating, Book } from "../types";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { fitsLength, languageCode, type SearchLanguage, type SearchLength, wordsMatch } from "./search";

/**
 * Book lists for Home and the landing page.
 *
 * With VITE_SUPABASE_URL set, every request goes to the `books` Edge Function, which is the
 * only thing that talks to Google Books (the browser never does, and never sees the API key).
 * Without it, the same pages are served from the sample catalog so the app still runs offline.
 */

export interface BookSummary {
  id: string;
  title: string;
  authors: string[];
  /** https URL from Google Books, or null to draw a cover. */
  cover: string | null;
  publishedYear: string | null;
  categories: string[];
  /** Pages in this edition, when known (search's length filter). */
  pageCount?: number | null;
  /** Set for titles from the LiteraryWorm catalog, which draws its own covers. */
  local?: Book;
}

export interface BookPage {
  items: BookSummary[];
  page: number;
  hasMore: boolean;
}

/** One Google Books title, as the `books` function shapes it for the details page. */
export interface VolumeDetail extends Omit<BookSummary, "local"> {
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  language: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
  /** Google's page for the title (where to preview or buy it). */
  previewLink: string | null;
  /** What Google's embedded viewer can show: every page, a sample, or nothing (null). */
  preview?: "full" | "partial" | null;
  /** Google rates it MATURE: Teen and Kids profiles don't see it. */
  mature: boolean;
}

export type FeedQuery =
  | { mode: "home" }
  | { mode: "genre"; genre: BrowseGenre }
  | {
      mode: "search";
      q: string;
      genre?: BrowseGenre | null;
      sort?: "relevance" | "newest";
      lang?: SearchLanguage | null;
      /** Checked here on each page: Google can't filter by length. */
      length?: SearchLength | null;
    }
  /**
   * One author's books on Google Books: credited to exactly that name (their page), or, for a
   * search by author (`loose`), to any author whose name has every word searched for.
   */
  | { mode: "author"; name: string; loose?: boolean; length?: SearchLength | null }
  /** The editions with one ISBN (its digits, from `cleanIsbn()`). */
  | { mode: "isbn"; isbn: string };

export class BooksApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const PAGE_SIZE = 20;
export const MAX_PAGE = 19;

export { usesBackend };

export function feedKey(query: FeedQuery): string {
  if (query.mode === "genre") return `genre:${query.genre}`;
  if (query.mode === "isbn") return `isbn:${query.isbn}`;
  if (query.mode === "author") return `author:${query.name}|${query.loose ? "loose" : ""}|${query.length ?? ""}`;
  if (query.mode === "search") {
    return `search:${query.q}|${query.genre ?? ""}|${query.sort ?? "relevance"}|${query.lang ?? ""}|${query.length ?? ""}`;
  }
  return "home";
}

export function fromLocal(book: Book): BookSummary {
  return {
    id: book.id,
    title: book.title,
    authors: [book.author],
    cover: null,
    publishedYear: String(book.year),
    categories: book.genres,
    pageCount: book.pages,
    local: book,
  };
}

const FRIENDLY: Record<string, string> = {
  rate_limited: "The book service is busy right now. Wait a moment, then try again.",
  upstream_timeout: "The book service took too long to answer. Try again.",
  upstream_error: "We couldn't reach the book service. Try again in a moment.",
  network: "You seem to be offline. Check your connection and try again.",
  not_found: "We couldn't find that book. The link may be old.",
  unavailable: "Book details need the book service, which isn't set up in this copy of the app.",
};

// Pages already fetched this session (memory only, like the rest of the app's state), so
// two lists asking for the same page, or going Back, don't call the function again.
const pageCache = new Map<string, Promise<BookPage>>();

function fetchRemote(query: FeedQuery, page: number): Promise<BookPage> {
  const params = new URLSearchParams({ mode: query.mode, page: String(page) });
  if (query.mode === "genre") params.set("genre", query.genre);
  if (query.mode === "author") params.set("name", query.name);
  if (query.mode === "isbn") params.set("isbn", query.isbn);
  if (query.mode === "search") {
    params.set("q", query.q);
    if (query.genre) params.set("genre", query.genre);
    if (query.sort === "newest") params.set("sort", "newest");
    if (query.lang) params.set("lang", query.lang);
  }
  const url = `${SUPABASE_URL}/functions/v1/books?${params}`;

  let pending = pageCache.get(url);
  if (!pending) {
    pending = withRetry(() => requestJson(url)).then((body) => {
      const data = body as { items: BookSummary[]; page: number; hasMore: boolean };
      // Google's author search also finds study guides and summaries that name the author in
      // their title: keep only books credited to them.
      const items =
        query.mode === "author" ? data.items.filter((b) => byAuthor(b.authors, query)) : data.items;
      return { items, page: data.page, hasMore: data.hasMore && page < MAX_PAGE };
    });
    pageCache.set(url, pending);
    // Failures aren't cached, so Try again really tries again.
    pending.catch(() => pageCache.delete(url));
  }
  return pending;
}

/** Whether a book's authors match an author query: exactly, or by every word for a search. */
function byAuthor(authors: string[], query: { name: string; loose?: boolean }): boolean {
  return authors.some((a) => (query.loose ? wordsMatch(a, query.name) : a.toLowerCase() === query.name.toLowerCase()));
}

const RETRY_AFTER_MS = 1500;

/** Google Books has short outages; ask once more by ourselves before showing the error. */
async function withRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    const transient = err instanceof BooksApiError && (err.code === "upstream_error" || err.code === "upstream_timeout");
    if (!transient) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    return request();
  }
}

async function requestJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { apikey: PUBLISHABLE_KEY! } });
  } catch {
    throw new BooksApiError("network", FRIENDLY.network);
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new BooksApiError(code, FRIENDLY[code] ?? error?.message ?? FRIENDLY.upstream_error);
  }
  return body;
}

const volumeCache = new Map<string, Promise<VolumeDetail>>();

/** A Google Books title for its details page, through the `books` Edge Function. */
export function fetchVolume(id: string): Promise<VolumeDetail> {
  if (!usesBackend) return Promise.reject(new BooksApiError("unavailable", FRIENDLY.unavailable));
  let pending = volumeCache.get(id);
  if (!pending) {
    const url = `${SUPABASE_URL}/functions/v1/books?${new URLSearchParams({ mode: "volume", id })}`;
    pending = withRetry(() => requestJson(url)) as Promise<VolumeDetail>;
    volumeCache.set(id, pending);
    pending.catch(() => volumeCache.delete(id));
  }
  return pending;
}

function localPage(query: FeedQuery, page: number, ageRating: AgeRating): BookPage {
  const allowed = books.filter((b) => isAllowed(b.ageRating, ageRating));
  // "home" is the technology list, so it matches technology titles like the Edge Function does.
  const genre = query.mode === "home" ? "technology" : query.mode === "genre" ? query.genre : null;
  const matching = genre
    ? allowed.filter((b) => b.genres.some((g) => sampleCatalogGenres[genre].includes(g)))
    : query.mode === "author"
      ? allowed.filter((b) => byAuthor([b.author], query) && fitsLength(b.pages, query.length ?? null))
      : allowed.filter(
          (b) =>
            query.mode === "search" &&
            b.title.toLowerCase().includes(query.q.toLowerCase()) &&
            (!query.lang || languageCode(b.language) === query.lang) &&
            fitsLength(b.pages, query.length ?? null),
        );
  const start = page * PAGE_SIZE;
  return {
    items: matching.slice(start, start + PAGE_SIZE).map(fromLocal),
    page,
    hasMore: start + PAGE_SIZE < matching.length,
  };
}

/**
 * One page of a list. Kids profiles always get the age-rated LiteraryWorm catalog: Google Books
 * can only rule out "mature" titles, which isn't the same as suitable for children.
 */
export async function fetchBookPage(
  query: FeedQuery,
  page: number,
  ageRating: AgeRating = "all",
): Promise<BookPage> {
  if (!usesBackend || ageRating === "kids") return localPage(query, page, ageRating);
  const result = await fetchRemote(query, page);
  if ((query.mode !== "search" && query.mode !== "author") || !query.length) return result;
  return { ...result, items: result.items.filter((b) => fitsLength(b.pageCount, query.length ?? null)) };
}
