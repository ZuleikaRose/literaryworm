import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { tk, tr } from "./i18n";

/**
 * "Previously…": what has happened in a public-domain title before the chapter a listener has
 * reached, written by Claude on the server (the `recaps` Edge Function) from the chapters before
 * it only, and kept there, so it can't give anything away.
 */

export interface ChapterRecap {
  /** The story so far. */
  soFar: string;
  /** The chapter just before. */
  lastChapter: string;
}

export class RecapError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: tk("We couldn't reach LiteraryWorm. Check your connection and try again."),
  rate_limited: tk("Lots of readers are asking right now. Wait a little, then try again."),
  upstream_error: tk("We couldn't write a recap just now. Try again later."),
  upstream_timeout: tk("Writing the recap took too long. Try again."),
  unavailable: tk("Recaps need the LiteraryWorm backend, which isn't set up in this copy of the app."),
};

/** Our words for an error code, in the reader's language (undefined for a code we have none for). */
const friendly = (code: string) => (Object.hasOwn(FRIENDLY, code) ? tr(FRIENDLY[code]) : undefined);

const isRecap = (r: unknown): r is ChapterRecap =>
  Boolean(r) && typeof (r as ChapterRecap).soFar === "string" && typeof (r as ChapterRecap).lastChapter === "string";

/** The recap of everything before `chapter` (0-based, at least 1). */
export async function fetchRecap(bookId: string, chapter: number): Promise<ChapterRecap> {
  if (!usesBackend) throw new RecapError(friendly("unavailable"));
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/recaps`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter }),
    });
  } catch {
    throw new RecapError(friendly("network"));
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new RecapError((code === "bad_request" || code === "not_found" ? error?.message : friendly(code)) ?? friendly("upstream_error"));
  }
  const recap = (body as { recap?: unknown } | null)?.recap;
  if (!isRecap(recap)) throw new RecapError(friendly("upstream_error"));
  return recap;
}
