// POST /functions/v1/discussion  { "id": "pride-and-prejudice", "chapter": 4 }
// Discussion questions for a book club: 5 to 8 open questions about one chapter (`chapter`,
// 0-based) of a public-domain title, written only from the text up to the end of that chapter,
// so they can't spoil anything later. Claude writes a chapter's questions the first time anyone
// asks; they're kept and every later club there gets the same ones. Nothing about the reader or
// the club is sent. Public like `recaps` (the demo household uses it without a session), so
// every field is validated, and new questions are rate limited per IP and capped each day.

import { contextText } from "../_shared/bookText.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const QUESTIONS_MIN = 5;
export const QUESTIONS_MAX = 8;
export const QUESTION_MAX = 300;

export type DiscussionBook = { title: string; author: string };

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => DiscussionBook | null;
  /** The book's chapters (the reader's text). */
  chapters: (id: string) => Promise<string[]>;
  /** The questions kept for this book's chapter (0-based), or null if there aren't any yet. */
  cached: (id: string, chapter: number) => Promise<string[] | null>;
  /** Keeps new questions, never replacing ones already kept, and returns the ones now kept. */
  keep: (id: string, chapter: number, questions: string[], model: string) => Promise<string[]>;
  /** Asks Claude about the text up to the end of `chapter`; returns what it wrote (checked by `checkQuestions`) and the model. */
  write: (input: { book: DiscussionBook; chapter: number; chapterCount: number; text: string }) => Promise<{ questions: unknown; model: string }>;
  /** Rate limits a request that needs new questions. */
  rateLimit?: (req: Request) => Promise<void>;
};

/** One question made safe to show: plain text on one line, within the limit, ending in a question mark. */
function cleanQuestion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").replace(/^[\s\d.)*•-]+/, "").trim();
  if (text.length < 10 || text.length > QUESTION_MAX) return null;
  return text.endsWith("?") ? text : null;
}

/** Claude's questions, made safe to show: 5 to 8 different questions, or null. */
export function checkQuestions(raw: unknown): string[] | null {
  const list = raw && typeof raw === "object" ? (raw as { questions?: unknown }).questions : null;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const item of list) {
    const question = cleanQuestion(item);
    if (!question || seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    questions.push(question);
    if (questions.length === QUESTIONS_MAX) break;
  }
  return questions.length >= QUESTIONS_MIN ? questions : null;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    onlyKeys(body, ["id", "chapter"]);
    const id = parseVolumeId(body.id);
    const chapter = parseInt(body.chapter, "chapter", 0, 999);

    const book = deps.book(id);
    if (!book) throw new HttpError("not_found", "Discussion questions work with LiteraryWorm's public-domain titles.");

    const kept = await deps.cached(id, chapter);
    if (kept) return json(req, METHODS, { questions: kept, chapter });

    await deps.rateLimit?.(req);
    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    // The text up to the end of this chapter only: nothing after it can leak into a question.
    const written = await deps.write({ book, chapter, chapterCount: chapters.length, text: contextText(chapters, chapter) });
    const questions = checkQuestions(written.questions);
    if (!questions) throw new HttpError("upstream_error", "We couldn't write questions just now. Try again later.");
    // A failed save still shows these questions; the next club just asks again.
    const shown = await deps.keep(id, chapter, questions, written.model).catch((err) => {
      console.error("discussion: couldn't keep questions", err);
      return questions;
    });
    return json(req, METHODS, { questions: shown, chapter });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
