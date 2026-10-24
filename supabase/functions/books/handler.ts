// GET /functions/v1/books — the only way the app reaches Google Books.
// Public (anonymous visitors), so every input is validated and each IP is
// rate limited.
//
//   ?mode=home&page=0                 books about "technology"
//   ?mode=search&q=dune&page=0        title-only search
//   ?mode=genre&genre=sci-fi&page=0   one of the six required genres
//   ?mode=volume&id=zyTCAlFPjgYC      one book's details

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";
import {
  callGoogle,
  GENRE_QUERIES,
  HOME_QUERY,
  listUrl,
  shapeDetail,
  shapePage,
  titleQuery,
  volumeUrl,
} from "../_shared/googleBooks.ts";
import { parseGenre, parsePage, parseQuery, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "GET";
const ALLOWED_PARAMS: Record<string, string[]> = {
  home: ["mode", "page"],
  search: ["mode", "q", "page"],
  genre: ["mode", "genre", "page"],
  volume: ["mode", "id"],
};

export type Deps = {
  fetcher?: typeof fetch;
  apiKey?: string;
  rateLimit?: (req: Request) => Promise<void>;
};

export async function handle(req: Request, deps: Deps = {}): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["GET"]);
    const params = new URL(req.url).searchParams;
    const mode = params.get("mode") ?? "home";
    const allowed = ALLOWED_PARAMS[mode];
    if (!allowed) throw new HttpError("bad_request", "mode must be home, search, genre or volume.");
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
    const q = mode === "search"
      ? titleQuery(parseQuery(params.get("q")))
      : mode === "genre"
      ? GENRE_QUERIES[parseGenre(params.get("genre"))]
      : HOME_QUERY;
    const body = await callGoogle(listUrl(q, page, deps.apiKey), deps.fetcher);
    return json(req, METHODS, shapePage(body, page), 200, { "Cache-Control": "public, max-age=300" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
