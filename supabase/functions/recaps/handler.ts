// POST /functions/v1/recaps  { "id": "pride-and-prejudice", "chapter": 4 }
// "Previously…" for a public-domain title: what has happened in the chapters before the one the
// listener has reached (`chapter`, 0-based, at least 1), written only from that text, so it
// can't spoil anything still to come. Claude writes a book's recap before a chapter the first
// time anyone asks; it's kept and every later listener there gets the same one. Public like
// `characters` (the demo household uses it without a session), so every field is validated,
// and new recaps are rate limited per IP and capped for everyone each day.

import { contextText } from "../_shared/bookText.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const SO_FAR_MAX = 1500;
export const LAST_CHAPTER_MAX = 800;

export type RecapBook = { title: string; author: string };

export interface Recap {
  /** The story so far, before the chapter the listener is starting. */
  soFar: string;
  /** The chapter just before it. */
  lastChapter: string;
}

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => RecapBook | null;
  /** The book's chapters (the reader's text). */
  chapters: (id: string) => Promise<string[]>;
  /** The recap kept for this book before this chapter (0-based), or null if there isn't one yet. */
  cached: (id: string, chapter: number) => Promise<Recap | null>;
  /** Keeps a new recap, never replacing one already kept, and returns the one now kept. */
  keep: (id: string, chapter: number, recap: Recap, model: string) => Promise<Recap>;
  /** Asks Claude about the chapters before `chapter`; returns what it wrote (checked by `checkRecap`) and the model. */
  write: (input: { book: RecapBook; chapter: number; chapterCount: number; text: string }) => Promise<{ recap: unknown; model: string }>;
  /** Rate limits a request that needs a new recap. */
  rateLimit?: (req: Request) => Promise<void>;
};

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  // Cut at the last full sentence that fits.
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max / 2 ? cut.slice(0, end + 1) : `${cut.slice(0, max - 1).trimEnd()}…`;
};

/** Claude's recap, made safe to show: both parts present, plain text, within the limits. */
export function checkRecap(raw: unknown): Recap | null {
  if (!raw || typeof raw !== "object") return null;
  const { so_far, last_chapter } = raw as Record<string, unknown>;
  const soFar = clean(so_far, SO_FAR_MAX);
  const lastChapter = clean(last_chapter, LAST_CHAPTER_MAX);
  return soFar && lastChapter ? { soFar, lastChapter } : null;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    onlyKeys(body, ["id", "chapter"]);
    const id = parseVolumeId(body.id);
    // Chapter 1 has nothing before it to recap.
    const chapter = parseInt(body.chapter, "chapter", 1, 999);

    const book = deps.book(id);
    if (!book) throw new HttpError("not_found", "Recaps work with LiteraryWorm's public-domain titles.");

    const kept = await deps.cached(id, chapter);
    if (kept) return json(req, METHODS, { recap: kept, chapter });

    await deps.rateLimit?.(req);
    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    // Only the chapters before the listener's: the one they're starting stays unread.
    const written = await deps.write({ book, chapter, chapterCount: chapters.length, text: contextText(chapters, chapter - 1) });
    const recap = checkRecap(written.recap);
    if (!recap) throw new HttpError("upstream_error", "We couldn't write a recap just now. Try again later.");
    // A failed save still shows this recap; the next listener just asks again.
    const shown = await deps.keep(id, chapter, recap, written.model).catch((err) => {
      console.error("recaps: couldn't keep a recap", err);
      return recap;
    });
    return json(req, METHODS, { recap: shown, chapter });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
