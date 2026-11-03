import { tk } from "./i18n";

/**
 * Translate a passage: the languages and the pure rules (no backend import, so Jest can load it).
 * The calls are in lib/translateApi.ts.
 */

/** The languages a passage can be translated into (the function's LANGUAGES has the same). */
export const TRANSLATE_LANGUAGES = [
  { code: "en", label: tk("English") },
  { code: "fr", label: tk("French") },
  { code: "de", label: tk("German") },
  { code: "es", label: tk("Spanish") },
  { code: "it", label: tk("Italian") },
  { code: "pt", label: tk("Portuguese") },
  { code: "nl", label: tk("Dutch") },
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
