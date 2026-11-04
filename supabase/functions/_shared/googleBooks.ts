// Google Books: build the request, call it with a timeout, and shape the
// response down to what the UI shows. The API keys come only from function
// secrets (GOOGLE_BOOKS_API_KEY, then the fallbacks in KEY_SECRETS) and never
// appear in a response or a log.

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
  fantasy: "subject:fantasy",
  mystery: "subject:mystery",
  thriller: "subject:thriller",
  romance: "subject:romance",
  classics: "subject:classics",
  "historical-fiction": 'subject:"historical fiction"',
  "young-adult": 'subject:"young adult fiction"',
  children: 'subject:"juvenile fiction"',
  biography: "subject:biography",
  history: "subject:history",
  science: "subject:science",
  "self-help": 'subject:"self-help"',
  poetry: "subject:poetry",
  // BISAC's LGBTQ+ categories (Fiction / LGBTQ+, Social Science / LGBTQ+ Studies) match the word lgbtq.
  lgbtqia: "subject:lgbtq",
  // The other top-level BISAC subjects, by their own headings.
  antiques: "subject:antiques",
  architecture: "subject:architecture",
  art: "subject:art",
  bibles: "subject:bibles",
  "body-mind-spirit": 'subject:"body, mind & spirit"',
  business: 'subject:"business & economics"',
  comics: 'subject:"comics & graphic novels"',
  computers: "subject:computers",
  cooking: "subject:cooking",
  crafts: 'subject:"crafts & hobbies"',
  design: "subject:design",
  drama: "subject:drama",
  education: "subject:education",
  family: 'subject:"family & relationships"',
  "foreign-language": 'subject:"foreign language study"',
  games: 'subject:"games & activities"',
  gardening: "subject:gardening",
  health: 'subject:"health & fitness"',
  "house-home": 'subject:"house & home"',
  humor: "subject:humor",
  "juvenile-nonfiction": 'subject:"juvenile nonfiction"',
  "language-arts": 'subject:"language arts & disciplines"',
  law: "subject:law",
  "literary-collections": 'subject:"literary collections"',
  "literary-criticism": 'subject:"literary criticism"',
  mathematics: "subject:mathematics",
  medical: "subject:medical",
  music: "subject:music",
  nature: "subject:nature",
  "performing-arts": 'subject:"performing arts"',
  pets: "subject:pets",
  philosophy: "subject:philosophy",
  photography: "subject:photography",
  "political-science": 'subject:"political science"',
  psychology: "subject:psychology",
  reference: "subject:reference",
  religion: "subject:religion",
  "social-science": 'subject:"social science"',
  sports: 'subject:"sports & recreation"',
  "study-aids": 'subject:"study aids"',
  transportation: "subject:transportation",
  travel: "subject:travel",
  "true-crime": 'subject:"true crime"',
  "young-adult-nonfiction": 'subject:"young adult nonfiction"',
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
  fantasy: "fantasy",
  mystery: "mystery",
  thriller: "thriller",
  romance: "romance",
  classics: '"classic novels"',
  "historical-fiction": '"historical fiction"',
  "young-adult": '"young adult"',
  children: '"children\'s books"',
  biography: "biography",
  history: "history",
  science: "science",
  "self-help": '"self help"',
  poetry: "poetry",
  lgbtqia: "lgbtq",
  antiques: "antiques collectibles",
  architecture: "architecture",
  art: "art",
  bibles: "bible",
  "body-mind-spirit": "spirituality",
  business: "business",
  comics: '"graphic novels"',
  computers: "computers",
  cooking: "cooking",
  crafts: "crafts",
  design: "design",
  drama: "plays",
  education: "education",
  family: "parenting",
  "foreign-language": '"language learning"',
  games: "games puzzles",
  gardening: "gardening",
  health: "health fitness",
  "house-home": '"home improvement"',
  humor: "humor",
  "juvenile-nonfiction": '"children's nonfiction"',
  "language-arts": "linguistics",
  law: "law",
  "literary-collections": "anthology",
  "literary-criticism": '"literary criticism"',
  mathematics: "mathematics",
  medical: "medicine",
  music: "music",
  nature: "nature",
  "performing-arts": '"performing arts"',
  pets: "pets",
  philosophy: "philosophy",
  photography: "photography",
  "political-science": "politics",
  psychology: "psychology",
  reference: "reference",
  religion: "religion",
  "social-science": "sociology",
  sports: "sports",
  "study-aids": '"study guide"',
  transportation: "transportation",
  travel: "travel",
  "true-crime": '"true crime"',
  "young-adult-nonfiction": '"young adult nonfiction"',
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
  /** Set on books from Open Library (_shared/openLibrary.ts); Google's books leave it out. */
  source?: "openlibrary";
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

/**
 * The function secrets holding Google Books keys, in the order they're tried. The first is
 * the main key; the others are fallbacks, asked only when Google refuses or fails a key
 * (quota used up, the key rejected, or Google failing on it), so the rows keep filling.
 */
export const KEY_SECRETS = [
  "GOOGLE_BOOKS_API_KEY",
  "GOOGLE_BOOKS_API_KEY_1_AMILLAGE",
  "GOOGLE_BOOKS_API_KEY_1_ALICEMILLAGE",
  "GOOGLE_BOOKS_API_KEY_1_ROSEZULEIKA",
  "GOOGLE_BOOKS_API_KEY_1_ALICESUCC",
  "GOOGLE_BOOKS_API_KEY_1_FEMSHEP",
] as const;

/** The keys that are set, in order, without repeats; `[undefined]` (keyless) when none are. */
export function googleKeys(read: (name: string) => string | undefined = (n) => Deno.env.get(n)): (string | undefined)[] {
  const keys = [...new Set(KEY_SECRETS.map((n) => read(n)?.trim()).filter((k): k is string => !!k))];
  return keys.length ? keys : [undefined];
}

/** A fallback key gets a shorter budget, so trying every key stays inside the app's patience. */
const FALLBACK_TIMEOUT_MS = 5000;
/**
 * No new key is started once this long has gone: a refused key answers in a moment, so every
 * key still gets its turn when quotas run out, but slow failures can't add up past ~20 s.
 */
const ALL_KEYS_BUDGET_MS = 15000;

/**
 * Calls Google with each key in turn until one answers. A key is passed over when Google
 * rate-limits it, refuses it (403, or a 400 about the key), fails with a 5xx after the
 * retries, or times out. A real answer, "not found" included, is returned at once.
 */
export async function callGoogleWithKeys(
  build: (key: string | undefined) => URL,
  keys: (string | undefined)[] = [undefined],
  fetcher: Fetcher = fetch,
  meta?: GoogleMeta,
): Promise<unknown> {
  const list = keys.length ? keys : [undefined];
  const started = Date.now();
  for (let i = 0; ; i++) {
    try {
      return await callGoogle(build(list[i]), fetcher, i === 0 ? TIMEOUT_MS : FALLBACK_TIMEOUT_MS, meta);
    } catch (err) {
      const outOfTime = Date.now() - started > ALL_KEYS_BUDGET_MS;
      if (i === list.length - 1 || outOfTime || !(err instanceof HttpError) || err.code === "not_found") throw err;
      // The key's position only, never the key.
      console.warn("google books: key", i + 1, "failed with", err.code, "- trying key", i + 2);
    }
  }
}

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 500;

/**
 * Calls Google with an 8-second budget. Google's list search often answers 503
 * "backendFailed" for a few seconds, so a 5xx is retried (waiting a little
 * longer each time, up to 6 attempts) while at least 1.5 seconds of the budget remain.
 */
export async function callGoogle(url: URL, fetcher: Fetcher = fetch, budgetMs = TIMEOUT_MS, meta?: GoogleMeta): Promise<unknown> {
  const deadline = Date.now() + budgetMs;
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
    // A 400 about the key (invalid, expired, restricted) is the key's problem, not the book's.
    if (res.status === 400 && /api[_ ]?key|keyInvalid|keyExpired/i.test(reason)) {
      throw new HttpError("upstream_error", "The book service had a problem. Try again.");
    }
    // 400 from Google on a bad id is a not-found for our purposes.
    if (res.status === 400) throw new HttpError("not_found", "We couldn't find that book.");
    throw new HttpError("upstream_error", "The book service had a problem. Try again.");
  }
  if (meta) meta.cacheSeconds = cacheSeconds(res.headers);
  try {
    return await res.json();
  } catch {
    throw new HttpError("upstream_error", "The book service sent something we couldn't read.");
  }
}

/** What a call learned besides the body: how long Google's cache headers let us keep the answer. */
export type GoogleMeta = { cacheSeconds?: number };

/**
 * How long Google's response may be kept, in seconds, from its cache headers (the Google APIs Terms
 * of Service, 5(e): never longer than the cache header permits, and no permanent copies). Zero when
 * it says no-store, no-cache or private (our cache serves everyone, so it's a shared cache), or gives
 * no lifetime at all. s-maxage wins over max-age, then Expires against Date.
 */
export function cacheSeconds(headers: Headers): number {
  const cc = (headers.get("Cache-Control") ?? "").toLowerCase();
  if (/(^|[,\s])(no-store|no-cache|private)([,=\s]|$)/.test(cc)) return 0;
  const directive = (name: string) => {
    const m = cc.match(new RegExp(`(?:^|[,\\s])${name}\\s*=\\s*"?(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const age = Number(headers.get("Age")) || 0;
  const lifetime = directive("s-maxage") ?? directive("max-age");
  if (lifetime !== null) return Math.max(lifetime - age, 0);
  const expires = Date.parse(headers.get("Expires") ?? "");
  if (Number.isFinite(expires)) {
    const date = Date.parse(headers.get("Date") ?? "");
    const from = Number.isFinite(date) ? date : Date.now();
    return Math.max(Math.floor((expires - from) / 1000) - age, 0);
  }
  return 0;
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
