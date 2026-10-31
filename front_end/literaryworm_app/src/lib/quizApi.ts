import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { isQuestion, type QuizQuestion } from "./quiz";

export type { QuizQuestion };

/**
 * Chapter quizzes: a few multiple-choice questions about a chapter of a public-domain title,
 * written by Claude on the server (the `quiz` Edge Function) from that chapter's text and kept
 * there. Only the book and chapter are sent; nothing about the reader.
 */
export class QuizError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "Lots of readers are asking right now. Wait a little, then try again.",
  upstream_error: "We couldn't write a quiz for this chapter just now. Try again later.",
  upstream_timeout: "Writing the quiz took too long. Try again.",
  unavailable: "Chapter quizzes need the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

/** The quiz for `chapter` (0-based). */
export async function fetchQuiz(bookId: string, chapter: number): Promise<QuizQuestion[]> {
  if (!usesBackend) throw new QuizError(FRIENDLY.unavailable);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/quiz`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter }),
    });
  } catch {
    throw new QuizError(FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new QuizError((code === "bad_request" || code === "not_found" ? error?.message : FRIENDLY[code]) ?? FRIENDLY.upstream_error);
  }
  const list = (body as { questions?: unknown } | null)?.questions;
  const questions = Array.isArray(list) ? list.filter(isQuestion) : [];
  if (questions.length < 3) throw new QuizError(FRIENDLY.upstream_error);
  return questions;
}

