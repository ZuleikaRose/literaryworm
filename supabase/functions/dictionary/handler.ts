// GET /functions/v1/dictionary?word=lantern[&lang=fr] — definitions for the reader's
// dictionary, in the book's own language. The only way the app reaches a dictionary. English:
// the Free Dictionary API (dictionaryapi.dev) first, and Wiktionary's own REST API when that one
// is down, slow or busy. Other languages: the Free Dictionary API serves English only (its
// /entries/<lang>/ answers 404 for French, Spanish or German), so Wiktionary's REST API, whose
// definition endpoint gives every language's entries for a word keyed by language code,
// explained in English. Both serve Wiktionary's definitions (CC BY-SA). Public like `books` (the
// demo household reads without a session), so the word and language are validated and each IP
// is rate limited.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, requireMethod } from "../_shared/http.ts";

const METHODS = "GET";
const FREE_DICTIONARY = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const WIKTIONARY = "https://en.wiktionary.org/api/rest_v1/page/definition/";
/** Each source gets this long, so a fallback still answers within the function's budget. */
const TIMEOUT_MS = 4000;
// Wikimedia asks API clients to say who they are.
const USER_AGENT = "LiteraryWorm-dictionary/1.0 (Supabase Edge Function; reading app demo)";

/** The site's languages (the app's 21): a word is looked up in the book's own, English by default. */
export const LANGUAGES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch", ja: "Japanese",
  zh: "Chinese", ko: "Korean", hi: "Hindi", ar: "Arabic", pl: "Polish", ru: "Russian", tr: "Turkish", sv: "Swedish",
  uk: "Ukrainian", tl: "Tagalog", bg: "Bulgarian", ro: "Romanian", el: "Greek",
};

/** One of LANGUAGES' codes; English when not given. */
export function parseLang(raw: string | null): string {
  if (raw === null) return "en";
  if (!Object.hasOwn(LANGUAGES, raw)) throw new HttpError("bad_request", "The dictionary doesn't have words in that language.");
  return raw;
}

/**
 * A word in another language: letters (and their marks, for Hindi or Arabic), with an
 * apostrophe or hyphen inside, 1–40 characters, its case kept (German nouns have capitals).
 */
export function parseForeignWord(raw: string | null): string {
  // Composed (NFC): "café" with a combining accent is looked up, and echoed, as "café".
  const word = (raw ?? "").normalize("NFC").trim().replace(/’/g, "'");
  if (!word) throw new HttpError("bad_request", "Send a word to look up.");
  if ([...word].length > 40) throw new HttpError("bad_request", "That word is too long to look up.");
  if (!/^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u.test(word)) throw new HttpError("bad_request", "Look up one word, using letters only.");
  return word;
}

/** Up to this many parts of speech, each with up to this many definitions. */
export const MAX_MEANINGS = 3;
export const MAX_DEFINITIONS = 3;

export type Definition = { definition: string; example: string | null };
export type Meaning = { partOfSpeech: string; definitions: Definition[] };
export type Entry = {
  word: string;
  phonetic: string | null;
  meanings: Meaning[];
  sourceUrl: string | null;
};

export type Deps = {
  fetcher?: typeof fetch;
  rateLimit?: (req: Request) => Promise<void>;
};

/**
 * One English word: letters, with an apostrophe or hyphen inside ("don't",
 * "well-known"), 1–40 characters. Returned in lower case.
 */
export function parseWord(raw: string | null): string {
  const word = (raw ?? "").normalize("NFC").trim().toLowerCase();
  if (!word) throw new HttpError("bad_request", "Send a word to look up.");
  if (word.length > 40) throw new HttpError("bad_request", "That word is too long to look up.");
  if (!/^[a-z]+(?:['’-][a-z]+)*$/.test(word)) {
    throw new HttpError("bad_request", "Look up one English word, using letters only.");
  }
  return word.replace("’", "'");
}

const text = (value: unknown, max = 400): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** Merges the API's entries into one, keeping only what the reader shows. */
export function shapeEntry(word: string, body: unknown): Entry {
  const entries = Array.isArray(body) ? body : [];
  let phonetic: string | null = null;
  let sourceUrl: string | null = null;
  const byPart = new Map<string, Definition[]>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    phonetic ??= text(e.phonetic, 80);
    if (!phonetic && Array.isArray(e.phonetics)) {
      for (const p of e.phonetics) phonetic ??= text((p as Record<string, unknown>)?.text, 80);
    }
    if (!sourceUrl && Array.isArray(e.sourceUrls)) {
      const url = text(e.sourceUrls[0], 300);
      if (url?.startsWith("https://")) sourceUrl = url;
    }
    if (!Array.isArray(e.meanings)) continue;
    for (const m of e.meanings) {
      const meaning = m as Record<string, unknown>;
      const part = text(meaning?.partOfSpeech, 40);
      if (!part || !Array.isArray(meaning.definitions)) continue;
      const list = byPart.get(part) ?? [];
      for (const d of meaning.definitions) {
        const definition = text((d as Record<string, unknown>)?.definition);
        if (definition && list.length < MAX_DEFINITIONS) {
          list.push({ definition, example: text((d as Record<string, unknown>)?.example) });
        }
      }
      if (list.length) byPart.set(part, list);
    }
  }
  const meanings = [...byPart].slice(0, MAX_MEANINGS).map(([partOfSpeech, definitions]) => ({ partOfSpeech, definitions }));
  if (meanings.length === 0) throw new HttpError("not_found", `No definition found for "${word}".`);
  return { word, phonetic, meanings, sourceUrl };
}

/** Wiktionary's definitions are HTML: keep the words only. */
export function plainText(html: unknown, max = 400): string | null {
  if (typeof html !== "string") return null;
  const stripped = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return stripped ? stripped.slice(0, max) : null;
}

/** Shapes Wiktionary's `{ en: [{ partOfSpeech, definitions: [{ definition, examples }] }], fr: … }`, for `lang`'s entries. */
export function shapeWiktionary(word: string, body: unknown, lang = "en"): Entry {
  const english = (body as Record<string, unknown> | null)?.[lang];
  const byPart = new Map<string, Definition[]>();
  for (const section of Array.isArray(english) ? english : []) {
    const s = section as Record<string, unknown>;
    const part = text(s?.partOfSpeech, 40)?.toLowerCase();
    if (!part || !Array.isArray(s.definitions)) continue;
    const list = byPart.get(part) ?? [];
    for (const d of s.definitions) {
      const item = d as Record<string, unknown>;
      const definition = plainText(item?.definition);
      if (!definition || list.length >= MAX_DEFINITIONS) continue;
      const examples = Array.isArray(item.examples) ? item.examples : [];
      list.push({ definition, example: plainText(examples[0]) });
    }
    if (list.length) byPart.set(part, list);
  }
  const meanings = [...byPart].slice(0, MAX_MEANINGS).map(([partOfSpeech, definitions]) => ({ partOfSpeech, definitions }));
  if (meanings.length === 0) throw new HttpError("not_found", lang === "en" ? `No definition found for "${word}".` : `No ${LANGUAGES[lang]} definition found for "${word}".`);
  return { word, phonetic: null, meanings, sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}${lang === "en" ? "" : `#${encodeURIComponent(LANGUAGES[lang])}`}` };
}

async function lookUp(url: URL, word: string, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new HttpError("upstream_timeout", "The dictionary took too long to answer. Try again.");
    }
    throw new HttpError("upstream_error", "We couldn't reach the dictionary. Try again.");
  }
  if (res.status === 404) {
    await res.body?.cancel();
    throw new HttpError("not_found", `No definition found for "${word}".`);
  }
  if (res.status === 429) {
    await res.body?.cancel();
    throw new HttpError("rate_limited", "The dictionary is busy right now. Wait a moment, then try again.", 30);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError("upstream_error", "The dictionary isn't answering right now. Try again.");
  }
  try {
    return await res.json();
  } catch {
    throw new HttpError("upstream_error", "The dictionary sent an answer we couldn't read. Try again.");
  }
}

export async function handle(req: Request, deps: Deps = {}): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["GET"]);
    const params = new URL(req.url).searchParams;
    for (const key of new Set(params.keys())) {
      if (key !== "word" && key !== "lang") throw new HttpError("bad_request", `Unexpected parameter: ${key}.`);
    }
    if (params.getAll("word").length > 1 || params.getAll("lang").length > 1) throw new HttpError("bad_request", "Send word and lang once.");
    const lang = parseLang(params.get("lang"));
    const word = lang === "en" ? parseWord(params.get("word")) : parseForeignWord(params.get("word"));

    await deps.rateLimit?.(req);

    const fetcher = deps.fetcher ?? fetch;
    if (lang !== "en") {
      // Wiktionary's page names keep their case: try the word as written, then its other case
      // ("Haus" for "haus", "maison" for "Maison").
      const other = word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word.toLowerCase();
      const tryWord = async (w: string) => shapeWiktionary(w, await lookUp(new URL(WIKTIONARY + encodeURIComponent(w)), w, fetcher), lang);
      const notFound = (err: unknown) => err instanceof HttpError && err.code === "not_found";
      let found: Entry;
      try {
        found = await tryWord(word);
      } catch (err) {
        if (!notFound(err)) throw err;
        if (other === word) throw new HttpError("not_found", `No ${LANGUAGES[lang]} definition found for "${word}".`);
        found = await tryWord(other).catch((again) => {
          throw notFound(again) ? new HttpError("not_found", `No ${LANGUAGES[lang]} definition found for "${word}".`) : again;
        });
      }
      return json(req, METHODS, { ...found, lang }, 200, { "Cache-Control": "public, max-age=86400" });
    }
    let entry: Entry;
    try {
      entry = shapeEntry(word, await lookUp(new URL(FREE_DICTIONARY + encodeURIComponent(word)), word, fetcher));
    } catch (err) {
      // An unknown word is an answer; anything else means try Wiktionary itself.
      if (err instanceof HttpError && err.code === "not_found") throw err;
      entry = shapeWiktionary(word, await lookUp(new URL(WIKTIONARY + encodeURIComponent(word)), word, fetcher));
    }
    // Definitions rarely change: let the browser and CDN keep them for a day.
    return json(req, METHODS, { ...entry, lang }, 200, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
