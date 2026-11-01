import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import type { TranslateLanguage } from "./translate";

export { codeOf, defaultTarget, passageFor, TRANSLATE_LANGUAGES, TRANSLATE_MAX, type TranslateLanguage } from "./translate";

/**
 * Translate a passage: words selected in a public-domain title, translated by Claude on the
 * server (the `translate` Edge Function). Only the passage is sent, and it must be in that
 * chapter. Not on Kids profiles, like Ask the book.
 */

export class TranslateError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach LiteraryWorm. Check your connection and try again.",
  rate_limited: "That's a lot of translations in a short time. Wait a little, then try again.",
  upstream_error: "We couldn't translate that just now. Try again later.",
  upstream_timeout: "Translating took too long. Try again.",
  unavailable: "Translate needs the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

export async function translatePassage(bookId: string, chapter: number, text: string, to: TranslateLanguage): Promise<string> {
  if (!usesBackend) throw new TranslateError(FRIENDLY.unavailable);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter, text, to }),
    });
  } catch {
    throw new TranslateError(FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    const message = code === "bad_request" || code === "not_found" ? error?.message : FRIENDLY[code];
    throw new TranslateError(message ?? FRIENDLY.upstream_error);
  }
  const translation = (body as { translation?: unknown } | null)?.translation;
  if (typeof translation !== "string") throw new TranslateError(FRIENDLY.upstream_error);
  return translation;
}
