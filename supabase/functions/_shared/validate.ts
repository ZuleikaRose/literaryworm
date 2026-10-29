// Input validation for anonymous and signed-in callers. Every value from the
// request is checked here before it reaches Google Books or the database.

import { HttpError } from "./http.ts";

export const GENRES = ["adventure", "technology", "horror", "sci-fi", "fiction", "non-fiction"] as const;
export type Genre = (typeof GENRES)[number];

export const MAX_QUERY_LENGTH = 100;
export const MAX_PAGE = 19; // 20 pages × 20 results; Google rarely returns more for one query
export const PAGE_SIZE = 20;

const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Letters, numbers, spaces and everyday punctuation. Excludes characters that
// would change the meaning of a Google query (e.g. ":" for "inauthor:").
const QUERY_CHARS = /^[\p{L}\p{N}\p{M} '’.,!?&()\-]+$/u;

export function parsePage(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  if (!/^\d{1,3}$/.test(raw)) throw new HttpError("bad_request", "page must be a whole number.");
  const page = Number(raw);
  if (page > MAX_PAGE) throw new HttpError("bad_request", `page must be between 0 and ${MAX_PAGE}.`);
  return page;
}

export function parseQuery(raw: string | null): string {
  const q = (raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!q) throw new HttpError("bad_request", "Enter a title to search for.");
  if (q.length > MAX_QUERY_LENGTH) {
    throw new HttpError("bad_request", `Search is limited to ${MAX_QUERY_LENGTH} characters.`);
  }
  if (!QUERY_CHARS.test(q)) throw new HttpError("bad_request", "Search can use letters, numbers and basic punctuation.");
  return q;
}

/** An author's name, for their page: the same characters and length as a search. */
export function parseName(raw: string | null): string {
  const name = (raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!name) throw new HttpError("bad_request", "Send the author's name.");
  if (name.length > MAX_QUERY_LENGTH) throw new HttpError("bad_request", `name is limited to ${MAX_QUERY_LENGTH} characters.`);
  if (!QUERY_CHARS.test(name)) throw new HttpError("bad_request", "name can use letters, numbers and basic punctuation.");
  return name;
}

export function parseGenre(raw: string | null): Genre {
  const g = (raw ?? "").toLowerCase();
  if (!(GENRES as readonly string[]).includes(g)) {
    throw new HttpError("bad_request", `genre must be one of: ${GENRES.join(", ")}.`);
  }
  return g as Genre;
}

export const SORTS = ["relevance", "newest"] as const;
export type Sort = (typeof SORTS)[number];

/** Optional sort for search results; Google's own orderBy values. */
/** Languages search can be narrowed to (ISO 639-1, as Google's langRestrict takes them). */
export const LANGUAGES = ["en", "es", "fr", "de", "it", "pt"] as const;
export type Language = (typeof LANGUAGES)[number];

export function parseLanguage(raw: string | null): Language | null {
  if (raw === null || raw === "") return null;
  if (!(LANGUAGES as readonly string[]).includes(raw)) {
    throw new HttpError("bad_request", `lang must be one of: ${LANGUAGES.join(", ")}.`);
  }
  return raw as Language;
}

export function parseSort(raw: string | null): Sort {
  if (raw === null || raw === "") return "relevance";
  if (!(SORTS as readonly string[]).includes(raw)) throw new HttpError("bad_request", "sort must be relevance or newest.");
  return raw as Sort;
}

export function parseVolumeId(raw: unknown): string {
  if (typeof raw !== "string" || !VOLUME_ID.test(raw)) throw new HttpError("bad_request", "That isn't a valid book id.");
  return raw;
}

export function parseUuid(raw: unknown, field: string): string {
  if (typeof raw !== "string" || !UUID.test(raw)) throw new HttpError("bad_request", `${field} must be a UUID.`);
  return raw.toLowerCase();
}

export function parseInt(raw: unknown, field: string, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new HttpError("bad_request", `${field} must be a whole number from ${min} to ${max}.`);
  }
  return raw;
}

export function parseText(raw: unknown, field: string, min: number, max: number): string {
  if (typeof raw !== "string") throw new HttpError("bad_request", `${field} is required.`);
  const value = raw.normalize("NFC").trim();
  if (value.length < min || value.length > max) {
    throw new HttpError("bad_request", `${field} must be ${min} to ${max} characters.`);
  }
  return value;
}

/** A Stripe promotion code as a member types it: letters, numbers, - and _ (3–40 characters). */
export function parsePromoCode(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError("bad_request", "Enter a promo code.");
  const code = raw.trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
    throw new HttpError("bad_request", "Enter the code as it was given: 3 to 40 letters, numbers, - or _.");
  }
  return code;
}

/** A gift code as a member types it: dashes, spaces and case don't matter. */
export function parseGiftCode(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError("bad_request", "Enter the gift code.");
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) {
    throw new HttpError("bad_request", "Enter the 16 letters and numbers of the gift code, like ABCD-EFGH-JKLM-NPQR.");
  }
  return code;
}

/** Rejects fields the endpoint doesn't expect, so typos and probes fail loudly. */
export function onlyKeys(body: Record<string, unknown>, allowed: string[]): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw new HttpError("bad_request", `Unexpected field: ${extra[0]}.`);
}
