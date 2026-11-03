import { GIFT_BOOKS_MAX } from "./gifts";

/**
 * Gift wishlists: a shared list (/lists/:slug) is also a wishlist. Its page offers *Give this list
 * as a gift*, which opens Gifts (/gifts?books=…&for=…) with up to GIFT_BOOKS_MAX of its LiteraryWorm
 * books picked; the buyer pays through the usual gift checkout, which checks the books again.
 */

/** The most characters of the list owner's name carried to Gifts. */
export const WISHLIST_NAME_MAX = 40;

/** The list's LiteraryWorm books a gift can come with: catalog ids, in the list's order, no repeats, at most 10. */
export function wishlistGiftBooks(items: readonly string[], isCatalog: (id: string) => boolean): string[] {
  const books: string[] = [];
  for (const id of items) {
    if (books.length >= GIFT_BOOKS_MAX) break;
    if (isCatalog(id) && !books.includes(id)) books.push(id);
  }
  return books;
}

/** How many of the list's LiteraryWorm books don't fit in one gift. */
export const wishlistLeftOut = (items: readonly string[], isCatalog: (id: string) => boolean) =>
  Math.max(0, new Set(items.filter(isCatalog)).size - GIFT_BOOKS_MAX);

/** Gifts, with the wishlist's books picked and who it's for. */
export function wishlistGiftPath(books: readonly string[], forName: string): string {
  const params = new URLSearchParams();
  if (books.length) params.set("books", books.join(","));
  const name = forName.trim().slice(0, WISHLIST_NAME_MAX);
  if (name) params.set("for", name);
  const query = params.toString();
  return query ? `/gifts?${query}` : "/gifts";
}

/** What Gifts takes from its address: catalog books only (checked again at checkout), and a short name. */
export function readWishlistParams(params: URLSearchParams, isCatalog: (id: string) => boolean): { books: string[]; forName: string | null } {
  const books = wishlistGiftBooks((params.get("books") ?? "").split(",").map((s) => s.trim()).filter(Boolean), isCatalog);
  const forName = (params.get("for") ?? "").replace(/\s+/g, " ").trim().slice(0, WISHLIST_NAME_MAX);
  return { books, forName: forName || null };
}
