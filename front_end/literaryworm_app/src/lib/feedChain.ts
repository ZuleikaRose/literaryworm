// Endless feeds: a list that runs on into further queries when one runs out (members' Home
// keeps scrolling from one genre into the next), and the sample the public home shows.

import type { BrowseGenre } from "../data/genres";
import type { FeedQuery } from "./booksApi";

/** How many books the public home shows to a visitor who isn't logged in: one page. */
export const VISITOR_SAMPLE = 20;

/** The query a genre's feed asks (Technology is the books function's home list); Open Library first when asked. */
export function genreQuery(genre: BrowseGenre, openLibrary = false): FeedQuery {
  const source = openLibrary ? ({ source: "openlibrary" } as const) : {};
  return genre === "technology" ? { mode: "home", ...source } : { mode: "genre", genre, ...source };
}

/**
 * Whether a profile's Home lists may come from Open Library: adult ("All") profiles only, since
 * Open Library has no maturity rating; Teen profiles keep Google's not-mature lists, Kids the catalog.
 */
export const openLibraryFor = (ageRating: string): boolean => ageRating === "all";

/** The genres a chained feed reads after `current`, in the order given (wrapping round), each once. */
export function genreOrderAfter(current: BrowseGenre, genres: readonly BrowseGenre[]): BrowseGenre[] {
  const start = genres.indexOf(current);
  const ordered = start < 0 ? genres : [...genres.slice(start + 1), ...genres.slice(0, start)];
  return ordered.filter((g) => g !== current);
}

/** The queries to run on into after `current` (genreOrderAfter() as feed queries). */
export function genresAfter(current: BrowseGenre, genres: readonly BrowseGenre[], openLibrary = false): FeedQuery[] {
  return genreOrderAfter(current, genres).map((g) => genreQuery(g, openLibrary));
}

/** Once a feed is this long, a Back to top button is offered. */
export const BACK_TO_TOP_AFTER = 40;

export type FeedStep = { step: number; page: number; done: boolean };

/**
 * Where a chained feed goes after a page comes back: the next page of the same query while it
 * has more, else the first page of the next query, else the end.
 */
export function nextFeedStep(step: number, page: number, hasMore: boolean, chainLength: number): FeedStep {
  if (hasMore) return { step, page: page + 1, done: false };
  if (step + 1 < chainLength) return { step: step + 1, page: 0, done: false };
  return { step, page, done: true };
}

/** A page with fewer books than this is topped up from the next page straight away. */
export const TOP_UP_BELOW = 8;
/** How many pages in a row a feed tops up on its own, before waiting for Load more again. */
export const TOP_UP_MAX = 3;

/**
 * Whether to fetch the next page at once: the page just loaded brought only a few books (a genre
 * whose pages keep only books filed under its heading can come back thin) and there's more to come.
 */
export function shouldTopUp(pageBooks: number, done: boolean, topUps: number): boolean {
  return !done && pageBooks < TOP_UP_BELOW && topUps < TOP_UP_MAX;
}

/** The books to show: every one loaded, or the first `limit` of them for a visitor's sample. */
export function sampleOf<T>(items: T[], limit: number | undefined): { shown: T[]; capped: boolean } {
  if (limit === undefined || items.length < limit) return { shown: items, capped: false };
  return { shown: items.slice(0, limit), capped: true };
}
