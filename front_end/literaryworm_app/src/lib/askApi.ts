import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/**
 * Ask the book: a question about a public-domain title, answered by Claude on the server (the
 * `ask` Edge Function) from the book's text up to the reader's chapter, so it can't spoil
 * what comes later.
 */

export const QUESTION_MAX = 500;

export class AskError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "That's a lot of questions in a short time. Wait a little, then try again.",
  upstream_error: "We couldn't answer that just now. Try again later.",
  upstream_timeout: "Answering took too long. Try again.",
  unavailable: "Ask the book needs the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

export async function askBook(bookId: string, chapter: number, question: string): Promise<string> {
  if (!usesBackend) throw new AskError(FRIENDLY.unavailable);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter, question }),
    });
  } catch {
    throw new AskError(FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    // The function's own words for a refused question or bad input; ours for everything else.
    const message = code === "bad_request" || code === "not_found" || (code === "upstream_error" && error?.message?.includes("another way")) ? error?.message : FRIENDLY[code];
    throw new AskError(message ?? FRIENDLY.upstream_error);
  }
  const answer = (body as { answer?: unknown } | null)?.answer;
  if (typeof answer !== "string") throw new AskError(FRIENDLY.upstream_error);
  return answer;
}
