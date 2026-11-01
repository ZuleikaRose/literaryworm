// POST /functions/v1/translate  { "id": "les-miserables", "chapter": 3, "text": "…", "to": "en" }
// Translates a passage the reader selected in a public-domain title. The passage must be in that
// chapter of the book's own text (so this is a reading aid, not a free translator for anything),
// and only the passage goes to Claude, never anything about the reader. Public like `ask` (the
// demo household uses it without a session), so every field is validated, each IP is rate limited
// and there's a daily cap on Claude calls for everyone.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseText, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const TEXT_MAX = 1000;
export const TRANSLATION_MAX = 4000;

/** The languages a passage can be translated into (src/lib/translateApi.ts has the same). */
export const LANGUAGES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
};

export type TranslateBook = { title: string; author: string };

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => TranslateBook | null;
  /** The book's chapters (the reader's text). */
  chapters: (id: string) => Promise<string[]>;
  /** Asks Claude; returns the translation. */
  translate: (input: { book: TranslateBook; text: string; to: string }) => Promise<string>;
  rateLimit?: (req: Request) => Promise<void>;
};

/** Spacing, case and curly quotes aside, the same words: a selection crosses line breaks and the page's typography. */
export const normalise = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    onlyKeys(body, ["id", "chapter", "text", "to"]);
    const id = parseVolumeId(body.id);
    const chapter = parseInt(body.chapter, "chapter", 0, 999);
    const text = parseText(body.text, "text", 1, TEXT_MAX);
    if (typeof body.to !== "string" || !Object.hasOwn(LANGUAGES, body.to)) {
      throw new HttpError("bad_request", `to must be one of ${Object.keys(LANGUAGES).join(", ")}.`);
    }
    const to = LANGUAGES[body.to];

    const book = deps.book(id);
    if (!book) throw new HttpError("not_found", "Translate works with LiteraryWorm's public-domain titles.");

    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    if (!normalise(chapters[chapter]).includes(normalise(text))) {
      throw new HttpError("bad_request", "Select words from the page to translate them.");
    }

    await deps.rateLimit?.(req);

    const translation = await deps.translate({ book, text, to });
    return json(req, METHODS, { translation: translation.slice(0, TRANSLATION_MAX), to: body.to });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
