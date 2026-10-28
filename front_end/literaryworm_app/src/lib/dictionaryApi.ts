import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/**
 * Definitions for the reader's dictionary, through the `dictionary` Edge Function (which asks
 * the Free Dictionary API, or Wiktionary itself, on the server). The browser never calls a
 * dictionary directly.
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
}

export class DictionaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  network: "We couldn't reach the dictionary. Check your connection and try again.",
  rate_limited: "That's a lot of lookups in a short time. Wait a moment, then try again.",
  upstream_error: "The dictionary isn't answering right now. Try again in a moment.",
  upstream_timeout: "The dictionary took too long to answer. Try again.",
  unavailable: "The dictionary needs the LiteraryWorm backend, which isn't set up in this copy of the app.",
};

/** The same rule as the function: one English word, letters with an inner apostrophe or hyphen. */
export function cleanWord(input: string): string | null {
  const word = input.trim().toLowerCase().replace(/’/g, "'");
  return word.length <= 40 && /^[a-z]+(?:['-][a-z]+)*$/.test(word) ? word : null;
}

// Words looked up this session (memory only, like the rest of the app's state).
const cache = new Map<string, Promise<DictionaryEntry>>();

export function lookUpWord(input: string): Promise<DictionaryEntry> {
  const word = cleanWord(input);
  if (!word) return Promise.reject(new DictionaryError("bad_request", "Look up one English word, using letters only."));
  if (!usesBackend) return Promise.reject(new DictionaryError("unavailable", FRIENDLY.unavailable));
  let pending = cache.get(word);
  if (!pending) {
    pending = request(word);
    cache.set(word, pending);
    pending.catch(() => cache.delete(word));
  }
  return pending;
}

async function request(word: string): Promise<DictionaryEntry> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/dictionary?${new URLSearchParams({ word })}`, {
      headers: { apikey: PUBLISHABLE_KEY! },
    });
  } catch {
    throw new DictionaryError("network", FRIENDLY.network);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    // "Not found" and "bad request" messages from the function already name the word.
    const message = code === "not_found" || code === "bad_request" ? error?.message : FRIENDLY[code];
    throw new DictionaryError(code, message ?? FRIENDLY.upstream_error);
  }
  return body as DictionaryEntry;
}
