// Google Books: build the request, call it with a timeout, and shape the
// response down to what the UI shows. The API key comes only from the
// GOOGLE_BOOKS_API_KEY function secret and never appears in a response.

import { HttpError } from "./http.ts";
import { type Genre, type Language, PAGE_SIZE, type Sort } from "./validate.ts";

const API = "https://www.googleapis.com/books/v1/volumes";
const TIMEOUT_MS = 8000;

// How each required genre becomes a Google query. Google Books has no genre
// field; `subject:` matches the volume's BISAC categories. Sci-Fi and
// Non-Fiction use the wording those categories actually use.
export const GENRE_QUERIES: Record<Genre, string> = {
  adventure: "subject:adventure",
  technology: "subject:technology",
  horror: "subject:horror",
  "sci-fi": 'subject:"science fiction"',
  fiction: "subject:fiction",
  "non-fiction": "subject:nonfiction",
};

// The same genres as plain words, for when Google answers a `subject:` query with
// nothing at all (it sometimes does for hours while plain searches still work).
export const GENRE_WORDS: Record<Genre, string> = {
  adventure: "adventure",
  technology: "technology",
  horror: "horror",
  "sci-fi": '"science fiction"',
  fiction: "fiction",
  "non-fiction": "nonfiction",
};

export const HOME_QUERY = "technology";

export type BookSummary = {
  id: string;
  title: string;
  authors: string[];
  cover: string | null;
  publishedYear: string | null;
  categories: string[];
  /** Pages in this edition, when Google knows (search's length filter uses it). */
  pageCount: number | null;
};

export type BookDetail = BookSummary & {
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  language: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
  previewLink: string | null;
  /**
   * What Google's embedded viewer can show on our page: "full" (every page), "partial" (a
   * sample) or null (not embeddable, or no pages to show).
   */
  preview: "full" | "partial" | null;
  /** Google marks some titles MATURE; Teen and Kids profiles don't see those. */
  mature: boolean;
};

export type BookPage = {
  items: BookSummary[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalItems: number;
};

type Fetcher = typeof fetch;

// --- Request building --------------------------------------------------------

/** Title-only search: every word must appear in the title. */
export function titleQuery(q: string): string {
  return q
    .split(" ")
    .filter(Boolean)
    .map((word) => `intitle:${word.replace(/["]/g, "")}`)
    .join(" ");
}

/** Books by one author: the whole name as a phrase, so "Matt Haig" doesn't match every Matt. */
export function authorQuery(name: string): string {
  return `inauthor:"${name.replace(/["]/g, "")}"`;
}

/** The search words with no operators: the fallback when `intitle:` finds nothing. */
export function plainQuery(q: string): string {
  return q.replace(/["]/g, "").split(" ").filter(Boolean).join(" ");
}

export function listUrl(
  q: string,
  page: number,
  key: string | undefined,
  sort: Sort = "relevance",
  lang: Language | null = null,
): URL {
  const url = new URL(API);
  url.searchParams.set("q", q);
  url.searchParams.set("startIndex", String(page * PAGE_SIZE));
  url.searchParams.set("maxResults", String(PAGE_SIZE));
  url.searchParams.set("printType", "books");
  if (sort === "newest") url.searchParams.set("orderBy", "newest");
  if (lang) url.searchParams.set("langRestrict", lang);
  // The home page is public and Teen profiles use it too: leave out mature titles.
  url.searchParams.set("maxAllowedMaturityRating", "not-mature");
  if (key) url.searchParams.set("key", key);
  return url;
}

export function volumeUrl(id: string, key: string | undefined): URL {
  const url = new URL(`${API}/${encodeURIComponent(id)}`);
  if (key) url.searchParams.set("key", key);
  return url;
}

// --- Calling Google ----------------------------------------------------------

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 500;

/**
 * Calls Google with an 8-second budget. Google's list search often answers 503
 * "backendFailed" for a few seconds, so a 5xx is retried (waiting a little
 * longer each time, up to 6 attempts) while at least 1.5 seconds of the budget remain.
 */
export async function callGoogle(url: URL, fetcher: Fetcher = fetch): Promise<unknown> {
  const deadline = Date.now() + TIMEOUT_MS;
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetcher(url, {
        signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new HttpError("upstream_timeout", "The book service took too long to answer. Try again.");
      }
      throw new HttpError("upstream_error", "We couldn't reach the book service. Try again.");
    }
    const canRetry = res.status >= 500 && attempt < MAX_ATTEMPTS && deadline - Date.now() > 1500;
    if (!canRetry) break;
    await res.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After")) || 30;
    await res.body?.cancel();
    throw new HttpError("rate_limited", "The book service is busy. Try again in a moment.", retry);
  }
  if (res.status === 404) {
    await res.body?.cancel();
    throw new HttpError("not_found", "We couldn't find that book.");
  }
  if (!res.ok) {
    // Log Google's status and reason for the function logs. Never log the URL: it holds the key.
    const reason = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
    console.error("google books error", res.status, reason);
    // 400 from Google on a bad id is a not-found for our purposes.
    if (res.status === 400) throw new HttpError("not_found", "We couldn't find that book.");
    throw new HttpError("upstream_error", "The book service had a problem. Try again.");
  }
  try {
    return await res.json();
  } catch {
    throw new HttpError("upstream_error", "The book service sent something we couldn't read.");
  }
}

// --- Shaping -----------------------------------------------------------------

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strings = (v: unknown, maxItems = 10): string[] =>
  Array.isArray(v) ? v.map((s) => str(s, 200)).filter((s): s is string => s !== null).slice(0, maxItems) : [];

/** Plain text from Google's HTML descriptions. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The best cover Google has, always over https; null when there's none. */
export function coverUrl(imageLinks: unknown): string | null {
  const links = obj(imageLinks);
  const raw = str(links.thumbnail, 1000) ?? str(links.smallThumbnail, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/^http:\/\//i, "https://"));
    if (url.protocol !== "https:" || !/(^|\.)(google\.com|googleusercontent\.com|googleapis\.com)$/.test(url.hostname)) {
      return null;
    }
    url.searchParams.delete("edge"); // drops the page-curl effect
    return url.toString();
  } catch {
    return null;
  }
}

export function shapeSummary(item: unknown): BookSummary | null {
  const raw = obj(item);
  const id = str(raw.id, 40);
  const info = obj(raw.volumeInfo);
  const title = str(info.title, 300);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !title) return null;
  const published = str(info.publishedDate, 20);
  return {
    id,
    title,
    authors: strings(info.authors),
    cover: coverUrl(info.imageLinks),
    publishedYear: published?.slice(0, 4) ?? null,
    categories: strings(info.categories, 5),
    pageCount: num(info.pageCount),
  };
}

export function shapeDetail(item: unknown): BookDetail {
  const summary = shapeSummary(item);
  if (!summary) throw new HttpError("not_found", "We couldn't find that book.");
  const info = obj(obj(item).volumeInfo);
  const description = str(info.description, 20000);
  const preview = str(info.previewLink, 1000);
  return {
    ...summary,
    subtitle: str(info.subtitle, 300),
    description: description ? stripHtml(description).slice(0, 8000) : null,
    publisher: str(info.publisher, 200),
    publishedDate: str(info.publishedDate, 20),
    pageCount: num(info.pageCount),
    language: str(info.language, 10),
    averageRating: num(info.averageRating),
    ratingsCount: num(info.ratingsCount),
    previewLink: preview?.startsWith("https://") ? preview : preview?.replace(/^http:\/\//, "https://") ?? null,
    preview: previewKind(obj(obj(item).accessInfo)),
    mature: info.maturityRating === "MATURE",
  };
}

function previewKind(access: Record<string, unknown>): BookDetail["preview"] {
  if (access.embeddable !== true) return null;
  if (access.viewability === "ALL_PAGES") return "full";
  if (access.viewability === "PARTIAL") return "partial";
  return null;
}

export function shapePage(body: unknown, page: number): BookPage {
  const raw = obj(body);
  const totalItems = num(raw.totalItems) ?? 0;
  const items: BookSummary[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    const book = shapeSummary(item);
    if (book && !seen.has(book.id)) {
      seen.add(book.id);
      items.push(book);
    }
  }
  const rawCount = Array.isArray(raw.items) ? raw.items.length : 0;
  // Google's totalItems is an estimate; a short page means we've reached the end.
  const hasMore = rawCount === PAGE_SIZE && (page + 1) * PAGE_SIZE < totalItems && page < 19;
  return { items, page, pageSize: PAGE_SIZE, hasMore, totalItems };
}
