// The books function's cache of Google Books answers (google_books_volumes, google_books_lists;
// migration 6666). Every kept answer expires: no later than Google's own cache headers allow
// (the Google APIs Terms of Service, 5(e): no copy kept longer than the cache header permits, and
// no permanent copies), and never more than CACHE_MAX_SECONDS. Nothing is served after it expires,
// and pg_cron deletes expired rows hourly. A cache that fails never fails a request: the function
// just asks Google as before.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import type { BookDetail, BookPage } from "./googleBooks.ts";
import type { Language, Sort } from "./validate.ts";

/** Our own ceiling on keeping any answer, even when Google's headers would allow longer: 7 days. */
export const CACHE_MAX_SECONDS = 7 * 24 * 60 * 60;

export interface BookCache {
  /** A volume's details while they may still be kept, or null (not kept, or expired). */
  getVolume(id: string): Promise<BookDetail | null>;
  /** Keeps a volume for `seconds` (already capped by keepFor()). */
  putVolume(detail: BookDetail, seconds: number): Promise<void>;
  /** A list page while it may still be kept, or null. */
  getList(key: string): Promise<BookPage | null>;
  putList(key: string, page: BookPage, seconds: number): Promise<void>;
}

/** How long to keep an answer: what Google's headers allow, at most CACHE_MAX_SECONDS; 0 keeps nothing. */
export function keepFor(googleSeconds: number | undefined): number {
  if (!googleSeconds || !Number.isFinite(googleSeconds) || googleSeconds <= 0) return 0;
  return Math.min(Math.floor(googleSeconds), CACHE_MAX_SECONDS);
}

/** Seconds left before a kept answer expires (0 once it has). */
export function secondsLeft(expiresAt: string | Date, now = Date.now()): number {
  const at = new Date(expiresAt).getTime();
  return Number.isFinite(at) ? Math.max(Math.floor((at - now) / 1000), 0) : 0;
}

/** The cache key for one list page: the query exactly as Google gets it. */
export function listCacheKey(q: string, page: number, sort: Sort, lang: Language | null): string {
  return JSON.stringify([q, page, sort, lang ?? ""]).slice(0, 600);
}

/** The cache kept in Postgres, through the service-role client. */
export function supabaseBookCache(client: SupabaseClient, now: () => number = Date.now): BookCache {
  const warn = (what: string, error: { message: string } | null) => {
    if (error) console.warn("book cache:", what, "failed:", error.message);
  };
  // One clock reading per save, so expires_at - fetched_at is exactly the allowed time (the table checks ≤ 7 days).
  const stamps = (seconds: number) => {
    const at = now();
    return { fetched_at: new Date(at).toISOString(), expires_at: new Date(at + seconds * 1000).toISOString() };
  };
  return {
    async getVolume(id) {
      const { data, error } = await client
        .from("google_books_volumes")
        .select("detail")
        .eq("id", id)
        .gt("expires_at", new Date(now()).toISOString())
        .maybeSingle();
      warn("read volume", error);
      return data ? (data.detail as BookDetail) : null;
    },
    async putVolume(detail, seconds) {
      if (seconds <= 0) return;
      const { error } = await client.from("google_books_volumes").upsert({
        id: detail.id,
        detail,
        ...stamps(seconds),
      });
      warn("save volume", error);
    },
    async getList(key) {
      const { data, error } = await client
        .from("google_books_lists")
        .select("page")
        .eq("key", key)
        .gt("expires_at", new Date(now()).toISOString())
        .maybeSingle();
      warn("read list", error);
      return data ? (data.page as BookPage) : null;
    },
    async putList(key, page, seconds) {
      if (seconds <= 0) return;
      const { error } = await client.from("google_books_lists").upsert({
        key,
        page,
        ...stamps(seconds),
      });
      warn("save list", error);
    },
  };
}
