// POST /functions/v1/quiz  { "id": "alice-in-wonderland", "chapter": 2 }
// A short chapter quiz for a public-domain title: a few multiple-choice questions about the
// chapter the reader has just read, written for young readers. Claude writes a chapter's quiz
// the first time anyone asks; it's kept and every later reader gets the same one. Nothing about
// the reader is sent: only the book and the chapter. Public like `characters` (the demo household
// uses it without a session), so every field is validated, and new quizzes are rate limited per
// IP and capped for everyone each day.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const QUESTIONS_MIN = 3;
export const QUESTIONS_MAX = 5;
export const QUESTION_MAX = 200;
export const CHOICE_MAX = 120;
export const EXPLANATION_MAX = 300;
/** The chapter's own text goes to Claude, up to this much (a long chapter is cut at the end). */
export const CHAPTER_CHARS = 60_000;

export type QuizBook = { title: string; author: string };

export interface Question {
  question: string;
  choices: string[];
  /** Index into choices. */
  answer: number;
  /** One sentence on why, from the chapter. */
  explanation: string;
}

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => QuizBook | null;
  chapters: (id: string) => Promise<string[]>;
  cached: (id: string, chapter: number) => Promise<Question[] | null>;
  /** Keeps a new quiz, never replacing one already kept, and returns the quiz now kept. */
  keep: (id: string, chapter: number, questions: Question[], model: string) => Promise<Question[]>;
  write: (input: { book: QuizBook; chapter: number; chapterCount: number; text: string }) => Promise<{ quiz: unknown; model: string }>;
  rateLimit?: (req: Request) => Promise<void>;
};

const clean = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

/** The chapter's text for Claude, cut to CHAPTER_CHARS at a paragraph. */
export function chapterText(chapters: string[], chapter: number): string {
  const text = chapters[chapter] ?? "";
  if (text.length <= CHAPTER_CHARS) return text;
  const cut = text.slice(0, CHAPTER_CHARS);
  const end = cut.lastIndexOf("\n\n");
  return `${end > 0 ? cut.slice(0, end) : cut}\n\n[The rest of the chapter is left out]`;
}

/**
 * Claude's quiz, made safe to show: well-formed questions only (3 or 4 different choices, the
 * answer one of them), trimmed to the limits, at most five; null when fewer than three are left.
 */
export function checkQuiz(raw: unknown): Question[] | null {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions) ? (raw as { questions: unknown[] }).questions : [];
  const out: Question[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { question, choices, answer, explanation } = item as Record<string, unknown>;
    if (typeof question !== "string" || !Array.isArray(choices) || typeof answer !== "number" || typeof explanation !== "string") continue;
    if (!choices.every((c) => typeof c === "string")) continue;
    const cleanChoices = (choices as string[]).map((c) => clean(c, CHOICE_MAX));
    const index = Math.trunc(answer);
    const distinct = new Set(cleanChoices.map((c) => c.toLowerCase())).size === cleanChoices.length;
    const q = clean(question, QUESTION_MAX);
    if (!q || cleanChoices.length < 3 || cleanChoices.length > 4 || !distinct || cleanChoices.some((c) => !c) || index < 0 || index >= cleanChoices.length) continue;
    out.push({ question: q, choices: cleanChoices, answer: index, explanation: clean(explanation, EXPLANATION_MAX) });
    if (out.length >= QUESTIONS_MAX) break;
  }
  return out.length >= QUESTIONS_MIN ? out : null;
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
    if (!book) throw new HttpError("not_found", "Chapter quizzes work with LiteraryWorm's public-domain titles.");

    const kept = await deps.cached(id, chapter);
    if (kept) return json(req, METHODS, { questions: kept, chapter });

    await deps.rateLimit?.(req);
    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    const text = chapterText(chapters, chapter);
    if (text.trim().length < 200) throw new HttpError("not_found", "This chapter is too short for a quiz.");
    const written = await deps.write({ book, chapter, chapterCount: chapters.length, text });
    const questions = checkQuiz(written.quiz);
    if (!questions) throw new HttpError("upstream_error", "We couldn't write a quiz for this chapter just now. Try again later.");
    // A failed save still shows this quiz; the next reader just asks again.
    const shown = await deps.keep(id, chapter, questions, written.model).catch((err) => {
      console.error("quiz: couldn't keep a quiz", err);
      return questions;
    });
    return json(req, METHODS, { questions: shown, chapter });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
