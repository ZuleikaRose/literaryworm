import { books, isAllowed } from "../data/books";
import type { AgeRating, Book, Follow } from "../types";
import { normalizeQuery, queryError, wordsMatch } from "./search";

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

/** An author an author search found, and how many of the books shown are theirs. */
export interface AuthorMatch {
  name: string;
  books: number;
}

/** How many authors an author search lists above its books. */
export const AUTHOR_MATCHES_MAX = 6;

/**
 * The authors of these books whose names have every word searched for (as the search matched
 * them), most books first; names a page address or a follow couldn't hold are left out.
 */
export function matchingAuthors(authorLists: string[][], q: string, max = AUTHOR_MATCHES_MAX): AuthorMatch[] {
  const counts = new Map<string, AuthorMatch>();
  for (const authors of authorLists) {
    for (const raw of new Set(authors)) {
      const name = personName(raw);
      if (!name || !wordsMatch(name, q)) continue;
      // The same person spelt with different case, spaces or dots (J. R. R. and J.R.R.) counts
      // once, under the first spelling seen.
      const key = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      const found = counts.get(key);
      if (found) found.books += 1;
      else counts.set(key, { name, books: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.books - a.books || a.name.localeCompare(b.name)).slice(0, max);
}

/** Two letters for an author's mark: "Ursula K. Le Guin" → "UK". */
export const personInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/**
 * The follower count to show: the one read when the page opened, moved by one when the profile
 * has followed or unfollowed since (so it changes straight away, without asking again).
 */
export function followerCountNow(loaded: number, followedAtLoad: boolean, followingNow: boolean): number {
  return Math.max(loaded + (followingNow ? 1 : 0) - (followedAtLoad ? 1 : 0), 0);
}

/** "1 follower", "1,204 followers", for a search's author list; nothing until someone follows. */
export const followersShort = (count: number) => (count <= 0 ? null : count === 1 ? "1 follower" : `${count.toLocaleString()} followers`);

/** "1 reader follows them", "12 readers follow them"; nothing until someone does. */
export const followerLabel = (count: number) => (count <= 0 ? null : count === 1 ? "1 reader follows them" : `${count.toLocaleString()} readers follow them`);
