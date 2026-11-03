import { describe, expect, it } from "@jest/globals";
import { readWishlistParams, wishlistGiftBooks, wishlistGiftPath, wishlistLeftOut } from "./wishlist";

const catalog = new Set(["dracula", "emma", "dune", ...Array.from({ length: 12 }, (_, i) => `book-${i}`)]);
const isCatalog = (id: string) => catalog.has(id);

describe("gift wishlists", () => {
  it("picks the list's LiteraryWorm books in order, without repeats or Google Books titles", () => {
    expect(wishlistGiftBooks(["dracula", "zyx123GoogleId", "emma", "dracula", "dune"], isCatalog)).toEqual(["dracula", "emma", "dune"]);
  });

  it("stops at the 10 a gift can come with, and says how many didn't fit", () => {
    const items = Array.from({ length: 12 }, (_, i) => `book-${i}`);
    expect(wishlistGiftBooks(items, isCatalog)).toHaveLength(10);
    expect(wishlistLeftOut(items, isCatalog)).toBe(2);
    expect(wishlistLeftOut(["dracula", "dracula"], isCatalog)).toBe(0);
  });

  it("opens Gifts with the books and who it's for", () => {
    expect(wishlistGiftPath(["dracula", "emma"], " Sam ")).toBe("/gifts?books=dracula%2Cemma&for=Sam");
    expect(wishlistGiftPath([], "")).toBe("/gifts");
  });

  it("reads Gifts' address back, keeping only catalog books and a short name", () => {
    const back = readWishlistParams(new URLSearchParams(wishlistGiftPath(["dracula", "emma"], "Sam").split("?")[1]), isCatalog);
    expect(back).toEqual({ books: ["dracula", "emma"], forName: "Sam" });
    const odd = readWishlistParams(new URLSearchParams("books=dracula,<x>,,emma&for=" + "A".repeat(80)), isCatalog);
    expect(odd.books).toEqual(["dracula", "emma"]);
    expect(odd.forName).toHaveLength(40);
    expect(readWishlistParams(new URLSearchParams(""), isCatalog)).toEqual({ books: [], forName: null });
  });
});
