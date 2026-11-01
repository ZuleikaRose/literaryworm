// GET /functions/v1/content-notes?id=dracula — a catalog book's content notes: for each of eight
// topics (violence, death, …) how much of it there is (none, mild, moderate, strong) and a short
// note, plus one line overall. Written by Claude from the book's details the first time anyone
// asks, kept in public.book_content_notes (service role only), so every reader and every parent
// sees the same notes. Public like `summaries` (the demo household reads without a session), so the
// id is validated and each IP is rate limited; writing new notes has its own, tighter limits.
// Nothing about the reader is sent: only the book's title, author, year and synopsis.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";
import { parseVolumeId } from "../_shared/validate.ts";

const METHODS = "GET";

/** The topics, in the order the page shows them (src/lib/contentNotes.ts has the same). */
export const TOPICS = ["violence", "death", "frightening", "language", "sexual_content", "substance_use", "discrimination", "self_harm"] as const;
export const LEVELS = ["none", "mild", "moderate", "strong"] as const;
export type Topic = (typeof TOPICS)[number];
export type Level = (typeof LEVELS)[number];

export const NOTE_MAX = 200;
export const OVERALL_MAX = 300;

export type ContentNote = { topic: Topic; level: Level; note: string };
export type ContentNotes = { overall: string; notes: ContentNote[] };

export type CatalogFacts = { id: string; title: string; author: string; year: number; synopsis: string; publicDomain: boolean };

export type Deps = {
  /** Notes already written, or null. */
  getCached: (id: string) => Promise<ContentNotes | null>;
  /** A catalog book's details, or null for any other id. */
  describe: (id: string) => CatalogFacts | null;
  /** Asks Claude; returns the notes and the model that wrote them. */
  write: (book: CatalogFacts) => Promise<ContentNotes & { model: string }>;
  store: (id: string, notes: ContentNotes, model: string) => Promise<void>;
  /** Every request. */
  rateLimit?: (req: Request) => Promise<void>;
  /** Only requests that need new notes written. */
  writeLimit?: (req: Request) => Promise<void>;
};

const failed = () => new HttpError("upstream_error", "We couldn't write content notes for this book. Try again later.");

/** Claude's answer, checked: every topic once, in order, with a known level and a short plain note. */
export function checkNotes(raw: unknown): ContentNotes {
  const value = raw as { overall?: unknown; notes?: unknown } | null;
  const overall = typeof value?.overall === "string" ? value.overall.trim() : "";
  if (!overall || overall.length > OVERALL_MAX || !Array.isArray(value?.notes)) throw failed();
  const byTopic = new Map<string, ContentNote>();
  for (const item of value.notes as { topic?: unknown; level?: unknown; note?: unknown }[]) {
    const topic = item?.topic;
    const level = item?.level;
    const note = typeof item?.note === "string" ? item.note.trim() : "";
    if (typeof topic !== "string" || !(TOPICS as readonly string[]).includes(topic)) throw failed();
    if (typeof level !== "string" || !(LEVELS as readonly string[]).includes(level)) throw failed();
    if (note.length > NOTE_MAX || byTopic.has(topic)) throw failed();
    byTopic.set(topic, { topic: topic as Topic, level: level as Level, note });
  }
  if (byTopic.size !== TOPICS.length) throw failed();
  return { overall, notes: TOPICS.map((t) => byTopic.get(t)!) };
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

    const book = deps.describe(id);
    if (!book) throw new HttpError("not_found", "Content notes are written for LiteraryWorm's own titles.");

    let notes = await deps.getCached(id);
    if (!notes) {
      await deps.writeLimit?.(req);
      const written = await deps.write(book);
      notes = { overall: written.overall, notes: written.notes };
      await deps.store(id, notes, written.model);
    }
    // Notes don't change once written: let the browser and CDN keep them for a day.
    return json(req, METHODS, { id, ...notes }, 200, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
