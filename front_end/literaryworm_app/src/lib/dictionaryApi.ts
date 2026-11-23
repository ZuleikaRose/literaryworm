import { DEMO_DICTIONARY, DEMO_DICTIONARY_EXAMPLE } from "../data/demoDictionary";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { bookLangTag } from "./languages";
import { tk, tr } from "./i18n";

/**
 * Definitions for the reader's dictionary, through the `dictionary` Edge Function (which asks
 * the Free Dictionary API, or Wiktionary itself, on the server). The browser never calls a
 * dictionary directly. The function is public, so the demo uses it too; when the backend isn't
 * there or can't be reached, the demo falls back to its own small dictionary
 * (data/demoDictionary.ts, English only), so a lookup there always works. Words are looked up in
 * the book's own language (`dictionaryLanguage()`), explained in English.
 */

export interface Definition {
  definition: string;
  example: string | null;
}

export interface DictionaryEntry {
  word: string;
  phonetic: string | null;
  meanings: { partOfSpeech: string; definitions: Definition[] }[];
  /** Wiktionary's page for the word, for the credit. */
  sourceUrl: string | null;
  /** From the demo's own small dictionary, credited as such. */
  demo?: boolean;
  /** The word's language (a DICTIONARY_LANGUAGES code); English when missing. */
  lang?: string;
}

export class DictionaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  network: tk("We couldn't reach the dictionary. Check your connection and try again."),
  rate_limited: tk("That's a lot of lookups in a short time. Wait a moment, then try again."),
  upstream_error: tk("The dictionary isn't answering right now. Try again in a moment."),
  upstream_timeout: tk("The dictionary took too long to answer. Try again."),
  unavailable: tk("The dictionary needs the LiteraryWorm backend, which isn't set up in this copy of the app."),
};

/** Our words for an error code, in the reader's language. */
const friendly = (code: keyof typeof FRIENDLY) => tr(FRIENDLY[code]);

/** The languages the dictionary looks words up in: the site's 21, as the `dictionary` function's LANGUAGES. */
export const DICTIONARY_LANGUAGES = ["en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl", "bg", "ro", "el"] as const;

/**
 * The dictionary language for a book's language ("French", "fr", "de-AT"…): its code when the
 * dictionary has it, null when it doesn't (then words are looked up in English). Unknown counts as English.
 */
export function dictionaryLanguage(language: string | null | undefined): string | null {
  const code = bookLangTag(language).split("-")[0].toLowerCase();
  return (DICTIONARY_LANGUAGES as readonly string[]).includes(code) ? code : null;
}

/**
 * The same rule as the function: one word, letters with an inner apostrophe or hyphen. English
 * words are a–z in lower case; other languages' words are any letters, their case kept.
 */
export function cleanWord(input: string, lang = "en"): string | null {
  if (lang !== "en") {
    const word = input.trim().replace(/’/g, "'");
    return [...word].length <= 40 && /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u.test(word) ? word : null;
  }
  const word = input.trim().toLowerCase().replace(/’/g, "'");
  return word.length <= 40 && /^[a-z]+(?:['-][a-z]+)*$/.test(word) ? word : null;
}

// Words looked up this session (memory only, like the rest of the app's state).
const cache = new Map<string, Promise<DictionaryEntry>>();

/**
 * The demo's own entry for a word, or `instead` (else a note naming a word it does have) when it
 * has none.
 */
export function demoLookUp(word: string, instead?: DictionaryError): Promise<DictionaryEntry> {
  const found = Object.hasOwn(DEMO_DICTIONARY, word) ? DEMO_DICTIONARY[word] : undefined;
  if (found) return Promise.resolve(found);
  return Promise.reject(
    instead ?? new DictionaryError("not_found", tr("The demo's offline dictionary has only some words from its books, such as “{example}”.", { example: DEMO_DICTIONARY_EXAMPLE })),
  );
}

export function lookUpWord(input: string, options: { demo?: boolean; lang?: string } = {}): Promise<DictionaryEntry> {
  const lang = options.lang ?? "en";
  const word = cleanWord(input, lang);
  if (!word) return Promise.reject(new DictionaryError("bad_request", lang === "en" ? tr("Look up one English word, using letters only.") : tr("Look up one word, using letters only.")));
  if (!usesBackend) {
    if (!options.demo) return Promise.reject(new DictionaryError("unavailable", friendly("unavailable")));
    return lang === "en" ? demoLookUp(word) : Promise.reject(new DictionaryError("unavailable", tr("The demo's offline dictionary has English words only.")));
  }
  const key = `${lang}:${word}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = request(word, lang);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  // The demo answers from its own (English) words when the function can't (not for a word it says doesn't exist).
  if (options.demo && lang === "en") return pending.catch((err: unknown) => (err instanceof DictionaryError && err.code !== "not_found" && err.code !== "bad_request" ? demoLookUp(word, err) : Promise.reject(err)));
  return pending;
}

async function request(word: string, lang: string): Promise<DictionaryEntry> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/dictionary?${new URLSearchParams(lang === "en" ? { word } : { word, lang })}`, {
      headers: { apikey: PUBLISHABLE_KEY! },
    });
  } catch {
    throw new DictionaryError("network", friendly("network"));
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    // "Not found" and "bad request" messages from the function already name the word.
    const message = code === "not_found" || code === "bad_request" ? error?.message : Object.hasOwn(FRIENDLY, code) ? friendly(code) : undefined;
    throw new DictionaryError(code, message ?? friendly("upstream_error"));
  }
  return { ...(body as DictionaryEntry), lang };
}
