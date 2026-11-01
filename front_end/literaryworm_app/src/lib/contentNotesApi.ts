import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import type { BookContentNotes } from "./contentNotes";

/** Content notes come only from the `content-notes` Edge Function (Claude never sees who asks). */

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "Lots of people are reading content notes right now. Try again in a minute.",
  upstream_error: "We couldn't write content notes for this book. Try again later.",
  upstream_timeout: "Writing the content notes took too long. Try again.",
  not_found: "Content notes are written for LiteraryWorm's own titles.",
  unavailable: "Content notes need the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

// Notes fetched this session (memory only, like the rest of the app's state).
const cache = new Map<string, Promise<BookContentNotes>>();

export function getContentNotes(bookId: string): Promise<BookContentNotes> {
  if (!usesBackend) return Promise.reject(new Error(FRIENDLY.unavailable));
  let pending = cache.get(bookId);
  if (!pending) {
    pending = request(bookId);
    cache.set(bookId, pending);
    pending.catch(() => cache.delete(bookId));
  }
  return pending;
}

async function request(id: string): Promise<BookContentNotes> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/content-notes?${new URLSearchParams({ id })}`, { headers: { apikey: PUBLISHABLE_KEY! } });
  } catch {
    throw new Error(FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = (body as { error?: { code?: string } } | null)?.error?.code ?? "upstream_error";
    throw new Error(FRIENDLY[code] ?? FRIENDLY.upstream_error);
  }
  const notes = body as Partial<BookContentNotes> | null;
  if (!notes || typeof notes.overall !== "string" || !Array.isArray(notes.notes)) throw new Error(FRIENDLY.upstream_error);
  return { overall: notes.overall, notes: notes.notes };
}
