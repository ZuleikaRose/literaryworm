// GET /functions/v1/books — the only way the app reaches Google Books.
// Public (anonymous visitors), so every input is validated and each IP is
// rate limited.
//
//   ?mode=home&page=0                 books about "technology"
//   ?mode=search&q=dune&page=0        title-only search
//     &genre=sci-fi&sort=newest         optional: narrow to a genre, newest first
//   ?mode=genre&genre=sci-fi&page=0   one of the six required genres
//   ?mode=author&name=Matt%20Haig&page=0  one author's books (their page)
//   ?mode=volume&id=zyTCAlFPjgYC      one book's details

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";
import {
  authorQuery,
  callGoogle,
  GENRE_QUERIES,
  GENRE_WORDS,
  HOME_QUERY,
  listUrl,
  plainQuery,
  shapeDetail,
  shapePage,
  titleQuery,
  volumeUrl,
} from "../_shared/googleBooks.ts";
import { parseGenre, parseName, parsePage, parseQuery, parseSort, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "GET";
const ALLOWED_PARAMS: Record<string, string[]> = {
  home: ["mode", "page"],
  search: ["mode", "q", "page", "genre", "sort"],
  genre: ["mode", "genre", "page"],
  author: ["mode", "name", "page"],
  volume: ["mode", "id"],
};

export type Deps = {
  fetcher?: typeof fetch;
  apiKey?: string;
  rateLimit?: (req: Request) => Promise<void>;
  /** Pause before re-asking Home after an empty first page (tests use 0). */
  emptyRetryMs?: number;
};

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
    if (!allowed) throw new HttpError("bad_request", "mode must be home, search, genre, author or volume.");
    for (const key of new Set(params.keys())) {
      if (!allowed.includes(key)) throw new HttpError("bad_request", `Unexpected parameter: ${key}.`);
      if (params.getAll(key).length > 1) throw new HttpError("bad_request", `Send ${key} once.`);
    }

    await deps.rateLimit?.(req);

    if (mode === "volume") {
      const id = parseVolumeId(params.get("id"));
      const body = await callGoogle(volumeUrl(id, deps.apiKey), deps.fetcher);
      return json(req, METHODS, shapeDetail(body), 200, { "Cache-Control": "public, max-age=3600" });
    }

    const page = parsePage(params.get("page"));
    let q = HOME_QUERY;
    // The same request without Google's operators, asked when the filtered one finds nothing.
    let plain = HOME_QUERY;
    if (mode === "search") {
      const words = parseQuery(params.get("q"));
      q = titleQuery(words);
      plain = plainQuery(words);
      // Still a title search: the genre only narrows it, through the same subject: query as genre mode.
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
    } else if (mode === "genre") {
      const genre = parseGenre(params.get("genre"));
      q = GENRE_QUERIES[genre];
      plain = GENRE_WORDS[genre];
    }
    const sort = mode === "search" ? parseSort(params.get("sort")) : "relevance";
    let body = await callGoogle(listUrl(q, page, deps.apiKey, sort), deps.fetcher);
    if (isEmptyList(body)) {
      if (plain !== q) {
        // Google sometimes answers every `subject:` and `intitle:` query with nothing while
        // plain searches still work, so ask with the plain words (looser: they can match
        // anywhere in the book, not just the title or subject).
        body = await callGoogle(listUrl(plain, page, deps.apiKey, sort), deps.fetcher);
      } else if (page === 0) {
        // When Google is struggling it sometimes answers 200 with no results at all. A real
        // "nothing found" is rare for a first page, so ask once more before believing it.
        await new Promise((resolve) => setTimeout(resolve, deps.emptyRetryMs ?? 600));
        body = await callGoogle(listUrl(q, page, deps.apiKey, sort), deps.fetcher);
      }
    }
    return json(req, METHODS, shapePage(body, page), 200, { "Cache-Control": "public, max-age=300" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
