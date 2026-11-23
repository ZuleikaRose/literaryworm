import { DEMO_DICTIONARY, DEMO_DICTIONARY_EXAMPLE } from "../data/demoDictionary";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { bookLangTag } from "./languages";
import { tk, tr } from "./i18n";

/**
 * Definitions for the reader's dictionary, through the `dictionary` Edge Function (which asks
 * the Free Dictionary API, or Wiktionary itself, on the server). The browser never calls a
 * dictionary directly. The function is public, so the demo uses it too; when the backend isn't
 * there or can't be reached, the demo falls back to its own small dictionary
 * (data/demoDictionary.ts), so a lookup there always works. English words only for now.
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

/** Whether a book's language is one the dictionary has words for (English; unknown counts as English). */
export const dictionaryCovers = (language: string | null | undefined) => bookLangTag(language).split("-")[0] === "en";

/** The same rule as the function: one English word, letters with an inner apostrophe or hyphen. */
export function cleanWord(input: string): string | null {
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

export function lookUpWord(input: string, options: { demo?: boolean } = {}): Promise<DictionaryEntry> {
  const word = cleanWord(input);
  if (!word) return Promise.reject(new DictionaryError("bad_request", tr("Look up one English word, using letters only.")));
  if (!usesBackend) return options.demo ? demoLookUp(word) : Promise.reject(new DictionaryError("unavailable", friendly("unavailable")));
  let pending = cache.get(word);
  if (!pending) {
    pending = request(word);
    cache.set(word, pending);
    pending.catch(() => cache.delete(word));
  }
  // The demo answers from its own words when the function can't (not for a word it says doesn't exist).
  if (options.demo) return pending.catch((err: unknown) => (err instanceof DictionaryError && err.code !== "not_found" && err.code !== "bad_request" ? demoLookUp(word, err) : Promise.reject(err)));
  return pending;
}

async function request(word: string): Promise<DictionaryEntry> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/dictionary?${new URLSearchParams({ word })}`, {
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
  return body as DictionaryEntry;
}
