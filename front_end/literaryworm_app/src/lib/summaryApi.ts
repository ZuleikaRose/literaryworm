import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/**
 * A book's short and detailed summaries, through the `summaries` Edge Function. Claude writes
 * them on the server the first time anyone asks for a book, and the function keeps them, so
 * later readers get the same text straight away.
 */

export interface BookSummaries {
  id: string;
  /** Two or three sentences, no spoilers. */
  short: string;
  /** Several paragraphs separated by blank lines; includes the ending. */
  detailed: string;
}

export class SummaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "That's a lot of summaries in a short time. Wait a little, then try again.",
  upstream_error: "We couldn't write a summary for this book. Try again later.",
  upstream_timeout: "Writing the summary took too long. Try again.",
  unavailable: "Summaries need the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

// Summaries fetched this session (memory only, like the rest of the app's state).
const cache = new Map<string, Promise<BookSummaries>>();

export function getSummaries(bookId: string): Promise<BookSummaries> {
  if (!usesBackend) return Promise.reject(new SummaryError("unavailable", FRIENDLY.unavailable));
  let pending = cache.get(bookId);
  if (!pending) {
    pending = request(bookId);
    cache.set(bookId, pending);
    pending.catch(() => cache.delete(bookId));
  }
  return pending;
}

async function request(id: string): Promise<BookSummaries> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/summaries?${new URLSearchParams({ id })}`, {
      headers: { apikey: PUBLISHABLE_KEY! },
    });
  } catch {
    throw new SummaryError("network", FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    const message = code === "not_found" || code === "bad_request" ? error?.message : FRIENDLY[code];
    throw new SummaryError(code, message ?? FRIENDLY.upstream_error);
  }
  return body as BookSummaries;
}
