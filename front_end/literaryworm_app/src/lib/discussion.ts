/**
 * Discussion questions for book clubs: rules the club page and the `discussion` Edge Function
 * share. Questions are about one chapter of a public-domain title and written only from the text
 * up to the end of it, so a reader is offered only chapters they've reached.
 */

export const QUESTIONS_MIN = 5;
export const QUESTIONS_MAX = 8;
export const QUESTION_MAX = 300;

/** Whether a club's book can have discussion questions: a public-domain catalog title (it has a recording). */
export const canDiscuss = (book: { recording?: unknown }) => Boolean(book.recording);

/** The chapters (0-based) a reader can ask about: the first one, and every one up to where they are. */
export function discussableChapters(upTo: number, chapterCount: number): number[] {
  const last = Math.min(Math.max(0, upTo), chapterCount - 1);
  return Array.from({ length: Math.max(0, last + 1) }, (_, i) => i);
}

/** The questions as the function sends them: 5 to 8 strings that end in a question mark, each within the limit. */
export function isQuestionList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= QUESTIONS_MIN &&
    value.length <= QUESTIONS_MAX &&
    value.every((q) => typeof q === "string" && q.length > 0 && q.length <= QUESTION_MAX && q.trim().endsWith("?"))
  );
}
