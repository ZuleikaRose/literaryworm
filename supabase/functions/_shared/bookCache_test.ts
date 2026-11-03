// deno test supabase/functions/_shared/bookCache_test.ts
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import { isFresh, LIST_FRESH_MS, listCacheKey, newEditionKeys, workKey } from "./bookCache.ts";
import type { BookPage, BookSummary } from "./googleBooks.ts";

const book = (id: string, title: string, authors: string[]): BookSummary => ({
  id,
  title,
  authors,
  cover: null,
  publishedYear: null,
  categories: [],
  pageCount: null,
});
const page = (items: BookSummary[]): BookPage => ({ items, page: 0, pageSize: 20, hasMore: false, totalItems: items.length });

Deno.test("every edition of a book has the same work key", () => {
  const key = workKey(book("a", "Dune", ["Frank Herbert"]));
  assertEquals(key, "dune|herbert");
  assertEquals(workKey(book("b", "DUNE: Deluxe Edition", ["Herbert, Frank"])), key);
  assertEquals(workKey(book("c", "Dune (Penguin Classics)", ["Frank Herbert", "Brian Herbert"])), key);
  assert(workKey(book("d", "Dune Messiah", ["Frank Herbert"])) !== key);
  assertEquals(workKey(book("e", "Les Misérables", ["Victor Hugo"])), "les miserables|hugo");
});

Deno.test("a list's key is the query as Google gets it", () => {
  assertEquals(listCacheKey("subject:horror", 2, "relevance", null), '["subject:horror",2,"relevance",""]');
  assert(listCacheKey("dune", 0, "newest", "es") !== listCacheKey("dune", 0, "relevance", "es"));
});

Deno.test("a list page is fresh for a week", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  assert(isFresh(new Date(now - LIST_FRESH_MS + 1000), now));
  assertFalse(isFresh(new Date(now - LIST_FRESH_MS - 1000), now));
  assertFalse(isFresh("not a date", now));
});

Deno.test("only volume ids a refreshed page didn't have before count as possible new editions", () => {
  const before = { page: page([]), volumeIds: ["a", "b"], fresh: false };
  const after = page([book("a", "Dune", ["Frank Herbert"]), book("z", "Dune: 60th Anniversary", ["Frank Herbert"])]);
  assertEquals(newEditionKeys(before, after), { keys: ["dune|herbert"], ids: ["z"] });
  // A page seen for the first time says nothing about new editions.
  assertEquals(newEditionKeys(null, after), { keys: [], ids: [] });
});
