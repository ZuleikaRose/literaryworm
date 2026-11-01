import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/**
 * Translate a passage: words selected in a public-domain title, translated by Claude on the
 * server (the `translate` Edge Function). Only the passage is sent, and it must be in that
 * chapter. Not on Kids profiles, like Ask the book.
 */

/** The languages a passage can be translated into (the function's LANGUAGES has the same). */
export const TRANSLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
] as const;
export type TranslateLanguage = (typeof TRANSLATE_LANGUAGES)[number]["code"];

export const TRANSLATE_MAX = 1000;

/** What to translate into first: English for a book in another language, else the last choice or Spanish. */
export function defaultTarget(bookLanguage: string | undefined, last: TranslateLanguage | null): TranslateLanguage {
  if (bookLanguage && bookLanguage !== "English") return last && last !== codeOf(bookLanguage) ? last : "en";
  return last && last !== "en" ? last : "es";
}

/** "French" → "fr" (null for a language we don't translate into). */
export function codeOf(language: string): TranslateLanguage | null {
  return TRANSLATE_LANGUAGES.find((l) => l.label === language)?.code ?? null;
}

/** Long selections are cut at the last sentence or word that fits. */
export function passageFor(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= TRANSLATE_MAX) return clean;
  const cut = clean.slice(0, TRANSLATE_MAX);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return sentence > TRANSLATE_MAX / 2 ? cut.slice(0, sentence + 1) : cut.slice(0, cut.lastIndexOf(" ")).trim();
}

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
