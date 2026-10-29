import { books, isAllowed } from "../data/books";
import type { AgeRating, Book, Follow } from "../types";
import { normalizeQuery, queryError } from "./search";

/** Authors and narrators: their pages, what they've made in the catalog, and following them. */

export type PersonKind = Follow["kind"];

/** The same limit as the database's follows.name. */
export const FOLLOWS_MAX = 200;

export function personPath(kind: PersonKind, name: string): string {
  return `/${kind === "author" ? "authors" : "narrators"}/${encodeURIComponent(name)}`;
}

/**
 * The name from a page's address, tidied as the `books` function will tidy it, or null when it
 * isn't one the function (or the follows table) would take.
 */
export function personName(raw: string | undefined): string | null {
  const name = normalizeQuery(raw ?? "");
  return name && !queryError(name) ? name : null;
}

export function isFollowing(follows: Follow[], kind: PersonKind, name: string): boolean {
  return follows.some((f) => f.kind === kind && f.name === name);
}

/** Catalog titles by this author or read by this narrator that the profile may see, newest first. */
export function catalogBy(kind: PersonKind, name: string, ageRating: AgeRating): Book[] {
  const key = name.toLowerCase();
  return books
    .filter((b) => isAllowed(b.ageRating, ageRating))
    .filter((b) => (kind === "author" ? b.author : b.narrator)?.toLowerCase() === key)
    .sort((a, b) => b.year - a.year);
}

/** Catalog titles from everyone the profile follows that aren't in its library yet, newest first. */
export function fromFollowed(follows: Follow[], ageRating: AgeRating, inLibrary: (id: string) => boolean): Book[] {
  const seen = new Set<string>();
  return follows
    .flatMap((f) => catalogBy(f.kind, f.name, ageRating))
    .filter((b) => !inLibrary(b.id) && !seen.has(b.id) && Boolean(seen.add(b.id)))
    .sort((a, b) => b.year - a.year);
}
