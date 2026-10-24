import { books, isAllowed } from "../data/books";
import { type BrowseGenre, sampleCatalogGenres } from "../data/genres";
import type { AgeRating, Book } from "../types";

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
  /** Set for titles from the BookWorm catalog, which draws its own covers. */
  local?: Book;
}

export interface BookPage {
  items: BookSummary[];
  page: number;
  hasMore: boolean;
}

export type FeedQuery = { mode: "home" } | { mode: "genre"; genre: BrowseGenre } | { mode: "search"; q: string };

export class BooksApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const PAGE_SIZE = 20;
export const MAX_PAGE = 19;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const usesBackend = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

export function feedKey(query: FeedQuery): string {
  return query.mode === "genre" ? `genre:${query.genre}` : query.mode === "search" ? `search:${query.q}` : "home";
}

export function fromLocal(book: Book): BookSummary {
  return {
    id: book.id,
    title: book.title,
    authors: [book.author],
    cover: null,
    publishedYear: String(book.year),
    categories: book.genres,
    local: book,
  };
}

const FRIENDLY: Record<string, string> = {
  rate_limited: "The book service is busy right now. Wait a moment, then try again.",
  upstream_timeout: "The book service took too long to answer. Try again.",
  upstream_error: "We couldn't reach the book service. Try again in a moment.",
  network: "You seem to be offline. Check your connection and try again.",
};

// Pages already fetched this session (memory only, like the rest of the app's state), so
// two lists asking for the same page, or going Back, don't call the function again.
const pageCache = new Map<string, Promise<BookPage>>();

function fetchRemote(query: FeedQuery, page: number): Promise<BookPage> {
  const params = new URLSearchParams({ mode: query.mode, page: String(page) });
  if (query.mode === "genre") params.set("genre", query.genre);
  if (query.mode === "search") params.set("q", query.q);
  const url = `${SUPABASE_URL}/functions/v1/books?${params}`;

  let pending = pageCache.get(url);
  if (!pending) {
    pending = requestPageWithRetry(url, page);
    pageCache.set(url, pending);
    // Failures aren't cached, so Try again really tries again.
    pending.catch(() => pageCache.delete(url));
  }
  return pending;
}

const RETRY_AFTER_MS = 1500;

/** Google Books has short outages; ask once more by ourselves before showing the error. */
async function requestPageWithRetry(url: string, page: number): Promise<BookPage> {
  try {
    return await requestPage(url, page);
  } catch (err) {
    const transient = err instanceof BooksApiError && (err.code === "upstream_error" || err.code === "upstream_timeout");
    if (!transient) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    return requestPage(url, page);
  }
}

async function requestPage(url: string, page: number): Promise<BookPage> {
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
  const data = body as { items: BookSummary[]; page: number; hasMore: boolean };
  return { items: data.items, page: data.page, hasMore: data.hasMore && page < MAX_PAGE };
}

function localPage(query: FeedQuery, page: number, ageRating: AgeRating): BookPage {
  const allowed = books.filter((b) => isAllowed(b.ageRating, ageRating));
  // "home" is the technology list, so it matches technology titles like the Edge Function does.
  const genre = query.mode === "home" ? "technology" : query.mode === "genre" ? query.genre : null;
  const matching = genre
    ? allowed.filter((b) => b.genres.some((g) => sampleCatalogGenres[genre].includes(g)))
    : allowed.filter((b) => query.mode === "search" && b.title.toLowerCase().includes(query.q.toLowerCase()));
  const start = page * PAGE_SIZE;
  return {
    items: matching.slice(start, start + PAGE_SIZE).map(fromLocal),
    page,
    hasMore: start + PAGE_SIZE < matching.length,
  };
}

/**
 * One page of a list. Kids profiles always get the age-rated BookWorm catalog: Google Books
 * can only rule out "mature" titles, which isn't the same as suitable for children.
 */
export async function fetchBookPage(
  query: FeedQuery,
  page: number,
  ageRating: AgeRating = "all",
): Promise<BookPage> {
  if (!usesBackend || ageRating === "kids") return localPage(query, page, ageRating);
  return fetchRemote(query, page);
}
