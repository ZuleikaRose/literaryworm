// deno test supabase/functions/_shared/bookCache_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { CACHE_MAX_SECONDS, keepFor, listCacheKey, secondsLeft } from "./bookCache.ts";
import { cacheSeconds } from "./googleBooks.ts";

const h = (init: Record<string, string>) => new Headers(init);

Deno.test("Google's cache headers decide how long an answer may be kept", () => {
  assertEquals(cacheSeconds(h({ "Cache-Control": "public, max-age=3600" })), 3600);
  assertEquals(cacheSeconds(h({ "Cache-Control": "public, max-age=3600, s-maxage=600" })), 600);
  assertEquals(cacheSeconds(h({ "Cache-Control": "max-age=3600", Age: "100" })), 3500);
  assertEquals(cacheSeconds(h({ Expires: "Tue, 03 Nov 2026 20:00:00 GMT", Date: "Tue, 03 Nov 2026 19:00:00 GMT" })), 3600);
});

Deno.test("nothing may be kept when Google says so, or says nothing", () => {
  assertEquals(cacheSeconds(h({})), 0);
  assertEquals(cacheSeconds(h({ "Cache-Control": "private, max-age=600" })), 0);
  assertEquals(cacheSeconds(h({ "Cache-Control": "no-cache" })), 0);
  assertEquals(cacheSeconds(h({ "Cache-Control": "public, no-store" })), 0);
  assertEquals(cacheSeconds(h({ "Cache-Control": "max-age=0, must-revalidate" })), 0);
  assertEquals(cacheSeconds(h({ Expires: "0" })), 0);
});

Deno.test("an answer is kept at most 7 days, and not at all without permission", () => {
  assertEquals(keepFor(600), 600);
  assertEquals(keepFor(10 * CACHE_MAX_SECONDS), CACHE_MAX_SECONDS);
  assertEquals(keepFor(0), 0);
  assertEquals(keepFor(undefined), 0);
  assertEquals(keepFor(-5), 0);
});

Deno.test("seconds left counts down to zero at expiry", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");
  assertEquals(secondsLeft("2026-11-03T12:01:00Z", now), 60);
  assertEquals(secondsLeft("2026-11-03T11:00:00Z", now), 0);
  assertEquals(secondsLeft("not a date", now), 0);
});

Deno.test("a list's key is the query as Google gets it", () => {
  assertEquals(listCacheKey("subject:horror", 2, "relevance", null), '["subject:horror",2,"relevance",""]');
  assert(listCacheKey("dune", 0, "newest", "es") !== listCacheKey("dune", 0, "relevance", "es"));
});
