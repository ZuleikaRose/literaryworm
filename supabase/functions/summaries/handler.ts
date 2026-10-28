// GET /functions/v1/summaries?id=pride-and-prejudice — a book's short and detailed
// summaries. Public like `books` (the demo household reads without a session), so
// the id is validated and each IP is rate limited. Summaries are written by Claude
// the first time a book is asked for and kept in public.book_summaries, so each
// book costs one Claude call; writing a new one has its own, tighter limits.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";
import { parseVolumeId } from "../_shared/validate.ts";

const METHODS = "GET";

/** What Claude is told about a book. */
export type BookFacts = {
  id: string;
  title: string;
  authors: string[];
  year: string | null;
  categories: string[];
  /** The catalog's synopsis or Google's description: untrusted text, passed to Claude as data. */
  description: string | null;
  publicDomain: boolean;
};

export type Summaries = { short: string; detailed: string };

export type Deps = {
  /** A summary already written, or null. */
  getCached: (id: string) => Promise<Summaries | null>;
  /** The book's details: the catalog's, or Google's for any other id. Throws not_found. */
  describe: (id: string) => Promise<BookFacts>;
  /** Asks Claude; returns the summaries and the model that wrote them. */
  write: (book: BookFacts) => Promise<Summaries & { model: string }>;
  store: (id: string, summaries: Summaries, model: string) => Promise<void>;
  /** Every request. */
  rateLimit?: (req: Request) => Promise<void>;
  /** Only requests that need a new summary written. */
  writeLimit?: (req: Request) => Promise<void>;
};

export const SHORT_MAX = 600;
export const DETAILED_MAX = 8000;

/** Claude's answer, checked: both summaries present, plain text, within the table's limits. */
export function checkSummaries(raw: unknown): Summaries {
  const value = raw as { short?: unknown; detailed?: unknown } | null;
  const short = typeof value?.short === "string" ? value.short.trim() : "";
  const detailed = typeof value?.detailed === "string" ? value.detailed.trim() : "";
  if (!short || !detailed || short.length > SHORT_MAX || detailed.length > DETAILED_MAX) {
    throw new HttpError("upstream_error", "We couldn't write a summary for this book. Try again later.");
  }
  return { short, detailed };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["GET"]);
    const params = new URL(req.url).searchParams;
    for (const key of new Set(params.keys())) {
      if (key !== "id") throw new HttpError("bad_request", `Unexpected parameter: ${key}.`);
    }
    if (params.getAll("id").length > 1) throw new HttpError("bad_request", "Send id once.");
    const id = parseVolumeId(params.get("id"));

    await deps.rateLimit?.(req);

    let summaries = await deps.getCached(id);
    if (!summaries) {
      const book = await deps.describe(id);
      await deps.writeLimit?.(req);
      const written = await deps.write(book);
      summaries = { short: written.short, detailed: written.detailed };
      await deps.store(id, summaries, written.model);
    }
    // Summaries don't change once written: let the browser and CDN keep them for a day.
    return json(req, METHODS, { id, ...summaries }, 200, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
