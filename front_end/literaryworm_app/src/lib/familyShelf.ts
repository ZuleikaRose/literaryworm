import type { Book, BookRequest, Profile } from "../types";
import { mayOpen } from "./bookRequests";

/**
 * The family shelf: catalog books a grown-up or teen profile puts out for the whole household
 * (`family_shelf`, per account). Every profile sees it on Home, but only the books it may already
 * open (its rating, or a grown-up's yes): the shelf never opens a book for a Kids profile.
 */

export interface FamilyShelfItem {
  bookId: string;
  /** The profile that added it; null once that profile is deleted. */
  addedBy: string | null;
  addedAt: number;
}

export const FAMILY_SHELF_MAX = 100;

/** Kids profiles look at the shelf; grown-up and teen profiles fill it. */
export function canFillShelf(profile: Pick<Profile, "ageRating">): boolean {
  return profile.ageRating !== "kids";
}

/** The shelf as `profile` sees it, newest first: catalog books it may open. */
export function shelfFor<B extends Pick<Book, "id" | "ageRating">>(
  items: FamilyShelfItem[],
  profile: Pick<Profile, "ageRating">,
  requests: BookRequest[],
  lookup: (id: string) => B | undefined,
): B[] {
  return [...items]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((i) => lookup(i.bookId))
    .filter((b): b is B => Boolean(b) && mayOpen(b!, profile, requests));
}
