import type { ProfileData } from "../types";

/** A profile's favourites, ratings, custom lists, recent searches, goals, reading days, player settings and uploads (saved per profile for members). */
export type Collections = Pick<
  ProfileData,
  "favorites" | "ratings" | "customLists" | "recentSearches" | "readingGoals" | "readingDays" | "player" | "uploads" | "follows" | "reminders"
>;

/** The same limits as the database. */
export const RECENT_SEARCHES_MAX = 8;
export const LIST_NAME_MAX = 40;
export const LIST_DESCRIPTION_MAX = 200;
export const LISTS_MAX = 50;
export const LIST_BOOKS_MAX = 200;

/** Newest first, no repeats (ignoring case), at most eight. */
export function withRecentSearch(searches: string[], q: string): string[] {
  const key = q.toLowerCase();
  return [q, ...searches.filter((s) => s.toLowerCase() !== key)].slice(0, RECENT_SEARCHES_MAX);
}

/** A random, unguessable token for a shared list's link: 16 bytes as 22 URL-safe characters. */
export function newShareSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const isShareSlug = (value: string) => /^[A-Za-z0-9_-]{22}$/.test(value);

/** The public address of a shared list. */
export const shareUrl = (slug: string) => `${window.location.origin}/lists/${slug}`;
