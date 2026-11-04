// GET /functions/v1/books — the only way the app reaches Google Books.
// Public (anonymous visitors), so every input is validated and each IP is
// rate limited.
//
//   ?mode=home&page=0                 books about "technology"
//   ?mode=search&q=dune&page=0        title-only search
//     &genre=sci-fi&sort=newest&lang=es optional: narrow to a genre or a language, newest first
//   ?mode=keywords&q=time%20travel&page=0  keywords anywhere Google indexes a book (title, author,
//     description, subjects); the same genre, sort and lang options as search
//   ?mode=genre&genre=sci-fi&page=0   one of the six required genres
//   ?mode=author&name=Matt%20Haig&page=0  one author's books (their page)
//   ?mode=isbn&isbn=9780141439518&page=0  the editions with that ISBN (10 or 13 digits)
//   ?mode=volume&id=zyTCAlFPjgYC      one book's details (an `ol-OL…W` id is an Open Library work)
//   &source=openlibrary               on home and genre: ask Open Library first, Google if it fails or
//                                     has nothing (members' Home for adult profiles; _shared/openLibrary.ts)
//
// Answers are kept in Supabase (_shared/bookCache.ts, migration 6666), each only as long as
// Google's cache headers allow and at most 7 days, then asked for again; nothing is served past
// that. Our own Cache-Control to the browser is capped the same way. X-Book-Cache says hit or miss.

import { type BookCache, keepFor, listCacheKey } from "../_shared/bookCache.ts";
import { preflight } from "../_shared/cors.ts";
import { isOpenLibraryId, OPEN_LIBRARY_KEEP_SECONDS, openLibraryDetail, openLibraryGenrePage } from "../_shared/openLibrary.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";
import {
  authorQuery,
  callGoogleWithKeys,
  GENRE_QUERIES,
  GENRE_WORDS,
  type GoogleMeta,
  HOME_QUERY,
  listUrl,
  plainQuery,
  shapeDetail,
  shapePage,
  titleQuery,
  volumeUrl,
} from "../_shared/googleBooks.ts";
import { parseGenre, parseIsbn, parseLanguage, parseName, parsePage, parseQuery, parseSort, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "GET";
const ALLOWED_PARAMS: Record<string, string[]> = {
  home: ["mode", "page", "source"],
  search: ["mode", "q", "page", "genre", "sort", "lang"],
  keywords: ["mode", "q", "page", "genre", "sort", "lang"],
  genre: ["mode", "genre", "page", "source"],
  author: ["mode", "name", "page"],
  isbn: ["mode", "isbn", "page"],
  volume: ["mode", "id"],
};

export type Deps = {
  fetcher?: typeof fetch;
  /** Google Books keys, main first then fallbacks (`googleKeys()`); none asks without a key. */
  apiKeys?: (string | undefined)[];
  rateLimit?: (req: Request) => Promise<void>;
  /** Pause before re-asking Home after an empty first page (tests use 0). */
  emptyRetryMs?: number;
  /** Asks Open Library (tests stub it); defaults to fetch. */
  openLibraryFetcher?: typeof fetch;
  /** Where Google's answers are kept (supabaseBookCache()); none asks Google every time. */
  cache?: BookCache;
};

/** A cache step that fails is logged and skipped: the request goes on without it. */
async function safely<T>(what: string, run: () => Promise<T> | undefined): Promise<T | undefined> {
  try {
    return await run();
  } catch (err) {
    console.warn("book cache:", what, "failed:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

function isEmptyList(body: unknown): boolean {
  const raw = body as { totalItems?: unknown; items?: unknown } | null;
  return !raw || ((raw.totalItems ?? 0) === 0 && !Array.isArray(raw.items));
}

export async function handle(req: Request, deps: Deps = {}): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["GET"]);
    const params = new URL(req.url).searchParams;
    const mode = params.get("mode") ?? "home";
    const allowed = ALLOWED_PARAMS[mode];
    if (!allowed) throw new HttpError("bad_request", "mode must be home, search, keywords, genre, author, isbn or volume.");
    for (const key of new Set(params.keys())) {
      if (!allowed.includes(key)) throw new HttpError("bad_request", `Unexpected parameter: ${key}.`);
      if (params.getAll(key).length > 1) throw new HttpError("bad_request", `Send ${key} once.`);
    }

    await deps.rateLimit?.(req);
    // What Google's cache headers allow for the last answer (the Google APIs Terms, 5(e)).
    const meta: GoogleMeta = {};
    const ask = (build: (key: string | undefined) => URL) => callGoogleWithKeys(build, deps.apiKeys, deps.fetcher, meta);
    /** Our Cache-Control: never longer than Google allows, nor than `ours`. */
    const browserCache = (ours: number) => {
      const seconds = Math.min(ours, keepFor(meta.cacheSeconds));
      return seconds > 0 ? `public, max-age=${seconds}` : "no-store";
    };

    if (mode === "volume") {
      const id = parseVolumeId(params.get("id"));
      const kept = await safely("read volume", () => deps.cache?.getVolume(id));
      if (!kept && isOpenLibraryId(id)) {
        const detail = await openLibraryDetail(id, deps.openLibraryFetcher);
        await safely("save volume", () => deps.cache?.putVolume(detail, OPEN_LIBRARY_KEEP_SECONDS));
        return json(req, METHODS, detail, 200, { "Cache-Control": "public, max-age=3600", "X-Book-Cache": "miss" });
      }
      // A kept copy is already within what Google allowed; the browser keeps it no more than a minute.
      if (kept) return json(req, METHODS, kept, 200, { "Cache-Control": "public, max-age=60", "X-Book-Cache": "hit" });
      const detail = shapeDetail(await ask((k) => volumeUrl(id, k)));
      await safely("save volume", () => deps.cache?.putVolume(detail, keepFor(meta.cacheSeconds)));
      return json(req, METHODS, detail, 200, { "Cache-Control": browserCache(3600), "X-Book-Cache": "miss" });
    }

    const page = parsePage(params.get("page"));
    if (params.has("source")) {
      if (params.get("source") !== "openlibrary") throw new HttpError("bad_request", "source must be openlibrary.");
      const genre = mode === "genre" ? parseGenre(params.get("genre")) : "technology";
      const olKey = `openlibrary:${genre}:${page}`;
      const keptOl = await safely("read list", () => deps.cache?.getList(olKey));
      if (keptOl) return json(req, METHODS, keptOl, 200, { "Cache-Control": "public, max-age=300", "X-Book-Cache": "hit" });
      try {
        const olPage = await openLibraryGenrePage(genre, page, deps.openLibraryFetcher);
        if (olPage.items.length) {
          await safely("save list", () => deps.cache?.putList(olKey, olPage, OPEN_LIBRARY_KEEP_SECONDS));
          return json(req, METHODS, olPage, 200, { "Cache-Control": "public, max-age=300", "X-Book-Cache": "miss", "X-Book-Source": "openlibrary" });
        }
      } catch (err) {
        // Open Library failing is no reason to fail the page: Google answers below as before.
        console.warn("open library failed, asking Google:", err instanceof Error ? err.message : String(err));
      }
    }
    let q = HOME_QUERY;
    // The same request without Google's operators, asked when the filtered one finds nothing.
    let plain = HOME_QUERY;
    if (mode === "search" || mode === "keywords") {
      const words = parseQuery(params.get("q"));
      // Keywords are Google's plain search: every word, anywhere it indexes the book.
      q = mode === "keywords" ? plainQuery(words) : titleQuery(words);
      plain = plainQuery(words);
      // Still a title (or keyword) search: the genre only narrows it, through the same subject: query as genre mode.
      if (params.has("genre")) {
        const genre = parseGenre(params.get("genre"));
        q += ` ${GENRE_QUERIES[genre]}`;
        plain += ` ${GENRE_WORDS[genre]}`;
      }
    } else if (mode === "author") {
      const name = parseName(params.get("name"));
      q = authorQuery(name);
      // Still only their books if Google ignores inauthor: for a while, just matched more loosely.
      plain = `"${name.replace(/["]/g, "")}"`;
    } else if (mode === "isbn") {
      const isbn = parseIsbn(params.get("isbn"));
      q = `isbn:${isbn}`;
      // The bare number still finds the book if Google ignores isbn: for a while.
      plain = isbn;
    } else if (mode === "genre") {
      const genre = parseGenre(params.get("genre"));
      q = GENRE_QUERIES[genre];
      plain = GENRE_WORDS[genre];
    }
    const filtered = mode === "search" || mode === "keywords";
    const sort = filtered ? parseSort(params.get("sort")) : "relevance";
    const lang = filtered ? parseLanguage(params.get("lang")) : null;
    const cacheKey = listCacheKey(q, page, sort, lang);
    const kept = await safely("read list", () => deps.cache?.getList(cacheKey));
    if (kept) return json(req, METHODS, kept, 200, { "Cache-Control": "public, max-age=60", "X-Book-Cache": "hit" });
    let body = await ask((k) => listUrl(q, page, k, sort, lang));
    if (isEmptyList(body)) {
      if (plain !== q) {
        // Google sometimes answers every `subject:` and `intitle:` query with nothing while
        // plain searches still work, so ask with the plain words (looser: they can match
        // anywhere in the book, not just the title or subject).
        body = await ask((k) => listUrl(plain, page, k, sort, lang));
      } else if (page === 0) {
        // When Google is struggling it sometimes answers 200 with no results at all. A real
        // "nothing found" is rare for a first page, so ask once more before believing it.
        await new Promise((resolve) => setTimeout(resolve, deps.emptyRetryMs ?? 600));
        body = await ask((k) => listUrl(q, page, k, sort, lang));
      }
    }
    const shaped = shapePage(body, page);
    // An empty page is often Google struggling, not the truth: don't keep it.
    if (shaped.items.length) await safely("save list", () => deps.cache?.putList(cacheKey, shaped, keepFor(meta.cacheSeconds)));
    return json(req, METHODS, shaped, 200, { "Cache-Control": browserCache(300), "X-Book-Cache": "miss" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
