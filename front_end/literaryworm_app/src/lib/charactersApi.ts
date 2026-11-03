import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { tk, tr } from "./i18n";

/**
 * Who's who: the characters a reader has met in a public-domain title up to their chapter,
 * written by Claude on the server (the `characters` Edge Function) from the book's text so far
 * and kept there, so it can't spoil anyone still to come.
 */

export interface BookCharacter {
  name: string;
  description: string;
  /** 1-based. */
  firstChapter: number;
}

export class CharactersError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: tk("We couldn't reach LiteraryWorm. Check your connection and try again."),
  rate_limited: tk("Lots of readers are asking right now. Wait a little, then try again."),
  upstream_error: tk("We couldn't put together who's who just now. Try again later."),
  upstream_timeout: tk("Putting together who's who took too long. Try again."),
  unavailable: tk("Who's who needs the LiteraryWorm backend, which isn't set up in this copy of the app."),
};

/** Our words for an error code, in the reader's language (undefined for a code we have none for). */
const friendly = (code: string) => (Object.hasOwn(FRIENDLY, code) ? tr(FRIENDLY[code]) : undefined);

const isCharacter = (c: unknown): c is BookCharacter =>
  Boolean(c) && typeof (c as BookCharacter).name === "string" && typeof (c as BookCharacter).description === "string" && typeof (c as BookCharacter).firstChapter === "number";

/** The characters met up to `chapter` (0-based), in the order the reader meets them. */
export async function fetchCharacters(bookId: string, chapter: number): Promise<BookCharacter[]> {
  if (!usesBackend) throw new CharactersError(friendly("unavailable"));
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/characters`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter }),
    });
  } catch {
    throw new CharactersError(friendly("network"));
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new CharactersError((code === "bad_request" || code === "not_found" ? error?.message : friendly(code)) ?? friendly("upstream_error"));
  }
  const list = (body as { characters?: unknown } | null)?.characters;
  // Never show anyone the reader hasn't reached, even if the server sent them.
  if (!Array.isArray(list)) throw new CharactersError(friendly("upstream_error"));
  return list.filter(isCharacter).filter((c) => c.firstChapter <= chapter + 1);
}
