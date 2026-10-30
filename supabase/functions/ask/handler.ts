// POST /functions/v1/ask  { "id": "pride-and-prejudice", "chapter": 4, "question": "Who is Mr Collins?" }
// Answers a reader's question about a public-domain title from its own text, up to the
// chapter they've reached, so the answer can't spoil what comes later. Public like
// `summaries` (the demo household asks without a session), so every field is validated,
// each IP is rate limited and there's a daily cap on Claude calls for everyone.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { contextText } from "../_shared/bookText.ts";
import { onlyKeys, parseInt, parseText, parseVolumeId } from "../_shared/validate.ts";

// The shared text helpers, for the tests and anything that imported them from here.
export { CONTEXT_CHARS, contextText } from "../_shared/bookText.ts";

const METHODS = "POST";

export const QUESTION_MIN = 3;
export const QUESTION_MAX = 500;
export const ANSWER_MAX = 4000;

export type AskBook = { title: string; author: string };

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => AskBook | null;
  /** The book's chapters (the reader's text). */
  chapters: (id: string) => Promise<string[]>;
  /** Asks Claude; returns the answer. */
  answer: (input: { book: AskBook; chapter: number; chapterCount: number; text: string; question: string }) => Promise<string>;
  rateLimit?: (req: Request) => Promise<void>;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    onlyKeys(body, ["id", "chapter", "question"]);
    const id = parseVolumeId(body.id);
    const chapter = parseInt(body.chapter, "chapter", 0, 999);
    const question = parseText(body.question, "question", QUESTION_MIN, QUESTION_MAX);

    const book = deps.book(id);
    if (!book) throw new HttpError("not_found", "Ask the book works with LiteraryWorm's public-domain titles.");

    await deps.rateLimit?.(req);

    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    const answer = await deps.answer({ book, chapter, chapterCount: chapters.length, text: contextText(chapters, chapter), question });
    return json(req, METHODS, { answer: answer.slice(0, ANSWER_MAX) });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
