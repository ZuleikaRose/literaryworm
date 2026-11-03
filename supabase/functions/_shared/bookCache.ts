// The books function's cache of Google Books answers (google_books_volumes, google_books_lists;
// migration 6666). A book's details are downloaded once and kept until another edition of it
// turns up; a list page is kept a week, and refreshing it is how new editions are noticed.
// A cache that fails never fails a request: the function just asks Google as before.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import type { BookDetail, BookPage, BookSummary } from "./googleBooks.ts";
import type { Language, Sort } from "./validate.ts";

/** How long a list page is served before Google is asked again (to spot new editions). */
export const LIST_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedList = { page: BookPage; volumeIds: string[]; fresh: boolean };

export interface BookCache {
  /** A volume's details, or null when it isn't kept or another edition has appeared since. */
  getVolume(id: string): Promise<BookDetail | null>;
  putVolume(detail: BookDetail): Promise<void>;
  getList(key: string): Promise<CachedList | null>;
  /** Keeps a page; `before` is the copy it replaces, so new editions in it can be noticed. */
  putList(key: string, page: BookPage, before: CachedList | null): Promise<void>;
}

/** The cache key for one list page: the query exactly as Google gets it. */
export function listCacheKey(q: string, page: number, sort: Sort, lang: Language | null): string {
  return JSON.stringify([q, page, sort, lang ?? ""]).slice(0, 600);
}

/** A list page is fresh for a week from when it was downloaded. */
export function isFresh(fetchedAt: string | Date, now = Date.now()): boolean {
  const at = new Date(fetchedAt).getTime();
  return Number.isFinite(at) && now - at < LIST_FRESH_MS;
}

/**
 * What every edition of a book shares: its title without a subtitle, lower case with only
 * letters and digits, and the first author's surname. "Dune: Deluxe Edition" by Frank Herbert
 * and "DUNE" by Herbert, Frank are the same work.
 */
export function workKey(book: Pick<BookSummary, "title" | "authors">): string {
  const clean = (s: string) =>
    s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const title = clean(book.title.split(/[:(]/)[0] || book.title);
  const author = book.authors[0] ?? "";
  // "Herbert, Frank" or "Frank Herbert": the surname either way.
  const surname = author.includes(",") ? author.split(",")[0] : author.trim().split(/\s+/).pop() ?? "";
  return `${title}|${clean(surname)}`.slice(0, 400);
}

/**
 * The work keys of books that came back with a volume id the cached page didn't have: each is
 * a possible new edition of a book whose details are kept.
 */
export function newEditionKeys(before: CachedList | null, page: BookPage): { keys: string[]; ids: string[] } {
  if (!before) return { keys: [], ids: [] };
  const known = new Set(before.volumeIds);
  const fresh = page.items.filter((b) => !known.has(b.id));
  return { keys: [...new Set(fresh.map(workKey))], ids: fresh.map((b) => b.id) };
}

/** The cache kept in Postgres, through the service-role client. */
export function supabaseBookCache(client: SupabaseClient): BookCache {
  const warn = (what: string, error: { message: string } | null) => {
    if (error) console.warn("book cache:", what, "failed:", error.message);
  };
  return {
    async getVolume(id) {
      const { data, error } = await client.from("google_books_volumes").select("detail, stale").eq("id", id).maybeSingle();
      warn("read volume", error);
      return data && !data.stale ? (data.detail as BookDetail) : null;
    },
    async putVolume(detail) {
      const { error } = await client.from("google_books_volumes").upsert({
        id: detail.id,
        detail,
        work_key: workKey(detail),
        stale: false,
        fetched_at: new Date().toISOString(),
      });
      warn("save volume", error);
    },
    async getList(key) {
      const { data, error } = await client.from("google_books_lists").select("page, volume_ids, fetched_at").eq("key", key).maybeSingle();
      warn("read list", error);
      if (!data) return null;
      return { page: data.page as BookPage, volumeIds: data.volume_ids ?? [], fresh: isFresh(data.fetched_at) };
    },
    async putList(key, page, before) {
      const volumeIds = page.items.map((b) => b.id).slice(0, 40);
      const { error } = await client.from("google_books_lists").upsert({
        key,
        page,
        volume_ids: volumeIds,
        fetched_at: new Date().toISOString(),
      });
      warn("save list", error);
      // Another edition of a book we keep: download that book's details again next time.
      const { keys, ids } = newEditionKeys(before, page);
      if (keys.length) {
        const { error: staleError } = await client
          .from("google_books_volumes")
          .update({ stale: true })
          .in("work_key", keys)
          .not("id", "in", `(${ids.join(",")})`);
        warn("mark editions", staleError);
      }
    },
  };
}
