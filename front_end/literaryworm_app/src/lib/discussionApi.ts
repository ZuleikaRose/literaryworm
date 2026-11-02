import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { isQuestionList } from "./discussion";

/**
 * Discussion questions about one chapter of a public-domain title, written by Claude on the
 * server (the `discussion` Edge Function) from the text up to the end of that chapter only, and
 * kept there so every club at that chapter gets the same ones. Only the book and chapter are sent.
 */

export class DiscussionError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "Lots of readers are asking right now. Wait a little, then try again.",
  upstream_error: "We couldn't write questions just now. Try again later.",
  upstream_timeout: "Writing the questions took too long. Try again.",
  unavailable: "Discussion questions need the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

/** The questions about `chapter` (0-based). */
export async function fetchDiscussion(bookId: string, chapter: number): Promise<string[]> {
  if (!usesBackend) throw new DiscussionError(FRIENDLY.unavailable);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/discussion`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter }),
    });
  } catch {
    throw new DiscussionError(FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new DiscussionError((code === "bad_request" || code === "not_found" ? error?.message : FRIENDLY[code]) ?? FRIENDLY.upstream_error);
  }
  const questions = (body as { questions?: unknown } | null)?.questions;
  if (!isQuestionList(questions)) throw new DiscussionError(FRIENDLY.upstream_error);
  return questions;
}
