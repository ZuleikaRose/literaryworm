// deno test supabase/functions/books — runs offline with a stubbed Google.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import type { BookCache } from "../_shared/bookCache.ts";
import type { BookDetail, BookPage } from "../_shared/googleBooks.ts";
import { handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

type Call = { url: URL };

function stub(status: number, body: unknown, headers: HeadersInit = {}) {
  const calls: Call[] = [];
  const fetcher = ((input: URL) => {
    calls.push({ url: new URL(input) });
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
  }) as typeof fetch;
  return { calls, fetcher };
}

function get(query: string, origin = ORIGIN) {
  return new Request(`http://local/books?${query}`, { headers: { Origin: origin } });
}

const volume = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  volumeInfo: {
    title: `Book ${id}`,
    authors: ["A. Writer"],
    imageLinks: { thumbnail: "http://books.google.com/books/content?id=x&zoom=1&edge=curl" },
    publishedDate: "2021-05-01",
    ...extra,
  },
});

const fullPage = { totalItems: 500, items: Array.from({ length: 20 }, (_, i) => volume(`id${i}`)) };

Deno.test("home asks Google for technology with the key server-side and shapes the result", async () => {
  const { calls, fetcher } = stub(200, fullPage);
  const res = await handle(get("mode=home&page=1"), { fetcher, apiKeys: ["test-key"] });
  assertEquals(res.status, 200);
  const url = calls[0].url;
  assertEquals(url.searchParams.get("q"), "technology");
  assertEquals(url.searchParams.get("startIndex"), "20");
  assertEquals(url.searchParams.get("maxResults"), "20");
  assertEquals(url.searchParams.get("maxAllowedMaturityRating"), "not-mature");
  const body = await res.json();
  assertEquals(body.items.length, 20);
  assert(body.hasMore);
  assertEquals(body.items[0].cover, "https://books.google.com/books/content?id=x&zoom=1");
  assertFalse(JSON.stringify(body).includes("test-key"), "API key must never reach the browser");
  assertEquals(Object.keys(body.items[0]).sort(), ["authors", "categories", "cover", "id", "pageCount", "publishedYear", "title"]);
});

Deno.test("an empty Home first page is asked for once more, then believed", async () => {
  let calls = 0;
  const flaky = (() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify(calls === 1 ? { totalItems: 0 } : fullPage), { status: 200 }));
  }) as typeof fetch;
  let res = await handle(get("mode=home"), { fetcher: flaky, emptyRetryMs: 0 });
  assertEquals((await res.json()).items.length, 20);
  assertEquals(calls, 2);

  const empty = stub(200, { totalItems: 0 });
  res = await handle(get("mode=home"), { ...empty, emptyRetryMs: 0 });
  assertEquals((await res.json()).items, []);
  assertEquals(empty.calls.length, 2, "one retry only");

  const later = stub(200, { totalItems: 0 });
  res = await handle(get("mode=home&page=3"), { ...later, emptyRetryMs: 0 });
  await res.body?.cancel();
  assertEquals(later.calls.length, 1, "later pages that run out are just the end");
});

Deno.test("an empty filtered list is asked again with plain words, once", async () => {
  const cases: [string, string, string][] = [
    ["mode=genre&genre=technology", "subject:technology", "technology"],
    ["mode=genre&genre=sci-fi&page=2", 'subject:"science fiction"', '"science fiction"'],
    ["mode=genre&genre=lgbtqia", "subject:lgbtq", "lgbtq"],
    ["mode=search&q=the%20hobbit", "intitle:the intitle:hobbit", "the hobbit"],
    ["mode=search&q=dune&genre=horror&sort=newest", "intitle:dune subject:horror", "dune horror"],
    ["mode=author&name=Matt%20Haig", 'inauthor:"Matt Haig"', '"Matt Haig"'],
    ["mode=search&q=dune&lang=es", "intitle:dune", "dune"],
    ["mode=keywords&q=time%20travel&genre=horror", "time travel subject:horror", "time travel horror"],
    ["mode=isbn&isbn=978-0-14-143951-8", "isbn:9780141439518", "9780141439518"],
  ];
  for (const [query, filtered, plain] of cases) {
    const calls: URL[] = [];
    const fetcher = ((input: URL) => {
      calls.push(new URL(input));
      return Promise.resolve(new Response(JSON.stringify(calls.length === 1 ? { totalItems: 0 } : fullPage), { status: 200 }));
    }) as typeof fetch;
    const res = await handle(get(query), { fetcher, emptyRetryMs: 0 });
    assertEquals((await res.json()).items.length, 20, query);
    assertEquals(calls.map((u) => u.searchParams.get("q")), [filtered, plain], query);
    assertEquals(calls[1].searchParams.get("startIndex"), calls[0].searchParams.get("startIndex"));
    assertEquals(calls[1].searchParams.get("orderBy"), calls[0].searchParams.get("orderBy"));
    assertEquals(calls[1].searchParams.get("langRestrict"), calls[0].searchParams.get("langRestrict"), "the fallback keeps the language");
    assertEquals(calls[0].searchParams.get("langRestrict"), query.includes("lang=es") ? "es" : null);
  }

  const empty = stub(200, { totalItems: 0 });
  const res = await handle(get("mode=search&q=zzzz"), { ...empty, emptyRetryMs: 0 });
  assertEquals((await res.json()).items, []);
  assertEquals(empty.calls.length, 2, "nothing either way is believed");
});

Deno.test("search is title-only", async () => {
  const { calls, fetcher } = stub(200, { totalItems: 0 });
  const res = await handle(get("mode=search&q=" + encodeURIComponent("  the  hobbit ")), { fetcher, emptyRetryMs: 0 });
  assertEquals(res.status, 200);
  assertEquals(calls[0].url.searchParams.get("q"), "intitle:the intitle:hobbit");
  const body = await res.json();
  assertEquals(body.items, []);
  assertFalse(body.hasMore);
});

Deno.test("search can narrow to a genre and sort by newest, and stays title-only", async () => {
  const { calls, fetcher } = stub(200, fullPage);
  const res = await handle(get("mode=search&q=dune&genre=sci-fi&sort=newest&page=2"), { fetcher });
  assertEquals(res.status, 200);
  await res.body?.cancel();
  assertEquals(calls[0].url.searchParams.get("q"), 'intitle:dune subject:"science fiction"');
  assertEquals(calls[0].url.searchParams.get("orderBy"), "newest");
  assertEquals(calls[0].url.searchParams.get("startIndex"), "40");

  const plain = stub(200, fullPage);
  const res2 = await handle(get("mode=search&q=dune"), plain);
  await res2.body?.cancel();
  assertEquals(plain.calls[0].url.searchParams.get("orderBy"), null);
});

Deno.test("each genre maps to a subject query", async () => {
  const expected: Record<string, string> = {
    adventure: "subject:adventure",
    technology: "subject:technology",
    horror: "subject:horror",
    "sci-fi": 'subject:"science fiction"',
    fiction: "subject:fiction",
    "non-fiction": "subject:nonfiction",
    fantasy: "subject:fantasy",
    "historical-fiction": 'subject:"historical fiction"',
    children: 'subject:"juvenile fiction"',
    "self-help": 'subject:"self-help"',
    lgbtqia: "subject:lgbtq",
  };
  for (const [genre, q] of Object.entries(expected)) {
    const { calls, fetcher } = stub(200, fullPage);
    const res = await handle(get(`mode=genre&genre=${genre}`), { fetcher });
    assertEquals(res.status, 200);
    await res.body?.cancel();
    assertEquals(calls[0].url.searchParams.get("q"), q);
  }
});

Deno.test("isbn mode asks Google for that ISBN, 10 or 13 digits", async () => {
  for (const [query, q] of [
    ["mode=isbn&isbn=978-0-14-143951-8", "isbn:9780141439518"],
    ["mode=isbn&isbn=0%2019%20852663%206", "isbn:0198526636"],
    ["mode=isbn&isbn=080442957x", "isbn:080442957X"],
  ]) {
    const { calls, fetcher } = stub(200, fullPage);
    const res = await handle(get(query), { fetcher });
    assertEquals(res.status, 200, query);
    await res.body?.cancel();
    assertEquals(calls[0].url.searchParams.get("q"), q);
  }
});

Deno.test("rejects bad input before calling Google", async () => {
  const cases = [
    "mode=search",                                   // missing query
    "mode=search&q=" + "a".repeat(101),              // oversized query
    "mode=search&q=inauthor%3Atolkien",              // operator injection
    "mode=home&page=20",                             // page out of range
    "mode=home&page=-1",
    "mode=home&page=1.5",
    "mode=genre&genre=westerns",                     // not one of the genres
    "mode=volume&id=..%2Fetc",                       // bad id
    "mode=nope",
    "mode=home&key=abc",                             // unexpected parameter
    "mode=home&page=1&page=2",                       // repeated parameter
    "mode=search&q=dune&sort=oldest",                // unknown sort
    "mode=search&q=dune&genre=westerns",             // genre outside the list
    "mode=genre&genre=horror&sort=newest",           // sort only applies to search
    "mode=home&genre=horror",                        // genre not allowed on home
    "mode=search&q=dune&lang=xx",                    // language outside the list
    "mode=search&q=dune&lang=EN",                    // languages are lower case
    "mode=genre&genre=horror&lang=es",               // lang only applies to search
    "mode=author",                                   // missing name
    "mode=author&name=x%3Ay%22",                     // operator injection
    "mode=author&name=Haig&q=dune",                  // q not allowed on author
    "mode=isbn",                                     // missing isbn
    "mode=isbn&isbn=9780141439519",                  // wrong check digit
    "mode=isbn&isbn=014143951",                      // too short
    "mode=isbn&isbn=isbn%3A9780141439518",           // operator injection
    "mode=isbn&isbn=9780141439518&lang=es",          // lang only applies to search
  ];
  for (const query of cases) {
    const { calls, fetcher } = stub(200, fullPage);
    const res = await handle(get(query), { fetcher });
    assertEquals(res.status, 400, query);
    assertEquals((await res.json()).error.code, "bad_request");
    assertEquals(calls.length, 0, `${query} should not reach Google`);
  }
});

Deno.test("maps upstream 429, 5xx and timeouts to friendly errors", async () => {
  let res = await handle(get("mode=home"), stub(429, {}, { "Retry-After": "12" }));
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "12");
  assertEquals((await res.json()).error.code, "rate_limited");

  const down = stub(503, {});
  res = await handle(get("mode=home"), down);
  assertEquals(res.status, 502);
  assert(down.calls.length >= 2, "retries a 5xx while time remains");
  assertEquals((await res.json()).error.code, "upstream_error");

  const timeout = (() => Promise.reject(new DOMException("timed out", "TimeoutError"))) as typeof fetch;
  res = await handle(get("mode=home"), { fetcher: timeout });
  assertEquals(res.status, 504);
  assertEquals((await res.json()).error.code, "upstream_timeout");
});

Deno.test("a 5xx from Google is retried", async () => {
  let calls = 0;
  const flaky = (() => {
    calls++;
    const body = calls === 1 ? { error: { code: 503 } } : fullPage;
    return Promise.resolve(new Response(JSON.stringify(body), { status: calls === 1 ? 503 : 200 }));
  }) as typeof fetch;
  const res = await handle(get("mode=home"), { fetcher: flaky });
  assertEquals(res.status, 200);
  assertEquals(calls, 2);
  await res.body?.cancel();
});

Deno.test("volume details strip HTML and handle missing cover and description", async () => {
  let res = await handle(
    get("mode=volume&id=abc123"),
    stub(200, volume("abc123", { description: "<p>Hello <b>world</b> &amp; more</p>", pageCount: 320, publisher: "Pub" })),
  );
  let body = await res.json();
  assertEquals(body.description, "Hello world & more");
  assertEquals(body.pageCount, 320);
  assertFalse(body.mature);

  assertEquals(body.preview, null, "no accessInfo: no preview");

  for (const [access, want] of [
    [{ embeddable: true, viewability: "PARTIAL" }, "partial"],
    [{ embeddable: true, viewability: "ALL_PAGES" }, "full"],
    [{ embeddable: true, viewability: "NO_PAGES" }, null],
    [{ embeddable: false, viewability: "PARTIAL" }, null],
    [{ embeddable: "true", viewability: "PARTIAL" }, null],
  ] as const) {
    res = await handle(get("mode=volume&id=abc123"), stub(200, { ...volume("abc123"), accessInfo: access }));
    assertEquals((await res.json()).preview, want, JSON.stringify(access));
  }

  res = await handle(get("mode=volume&id=abc123"), stub(200, volume("abc123", { maturityRating: "MATURE" })));
  assert((await res.json()).mature, "Google's MATURE rating is passed on");

  res = await handle(get("mode=volume&id=abc123"), stub(200, { id: "abc123", volumeInfo: { title: "Bare" } }));
  body = await res.json();
  assertEquals(body.cover, null);
  assertEquals(body.description, null);
  assertEquals(body.authors, []);

  res = await handle(get("mode=volume&id=missing1"), stub(404, {}));
  assertEquals(res.status, 404);
});

Deno.test("CORS: allowed origin echoed, others not, preflight answered", async () => {
  let res = await handle(get("mode=home"), stub(200, fullPage));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assertEquals(res.headers.get("Vary"), "Origin");
  await res.body?.cancel();

  res = await handle(get("mode=home", "https://evil.example"), stub(200, fullPage));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  await res.body?.cancel();

  res = await handle(new Request("http://local/books", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
  assertEquals(res.status, 204);
  assert(res.headers.get("Access-Control-Allow-Methods")?.includes("GET"));

  res = await handle(new Request("http://local/books?mode=home", { method: "POST", headers: { Origin: ORIGIN } }));
  assertEquals(res.status, 405);
});

Deno.test("rate limiter runs before Google and its refusal is a 429", async () => {
  const { HttpError } = await import("../_shared/http.ts");
  const { calls, fetcher } = stub(200, fullPage);
  const res = await handle(get("mode=home"), {
    fetcher,
    rateLimit: () => Promise.reject(new HttpError("rate_limited", "Too many requests.", 60)),
  });
  assertEquals(res.status, 429);
  assertEquals(calls.length, 0);
});

// Answers each call by the key in its URL: `byKey[key]` is the status, 200 gives a full page.
function keyed(byKey: Record<string, number>, reason = "", ok: unknown = fullPage) {
  const keys: (string | null)[] = [];
  const fetcher = ((input: URL) => {
    const key = new URL(input).searchParams.get("key");
    keys.push(key);
    const status = byKey[key ?? ""] ?? 200;
    const body = status === 200 ? ok : { error: { code: status, message: reason } };
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
  return { keys, fetcher };
}

Deno.test("a rate-limited or refused key falls back to the next key", async () => {
  for (const status of [429, 403]) {
    const { keys, fetcher } = keyed({ main: status });
    const res = await handle(get("mode=home"), { fetcher, apiKeys: ["main", "spare1", "spare2"] });
    assertEquals(res.status, 200);
    assertEquals(keys, ["main", "spare1"]);
    assertEquals((await res.json()).items.length, 20);
  }
});

Deno.test("a 400 about the key falls back, but a 400 about the book is not found", async () => {
  let { keys, fetcher } = keyed({ main: 400 }, "API key not valid. Please pass a valid API key.", volume("abc123"));
  let res = await handle(get("mode=volume&id=abc123"), { fetcher, apiKeys: ["main", "spare1"] });
  assertEquals(res.status, 200);
  assertEquals(keys, ["main", "spare1"]);
  await res.body?.cancel();

  ({ keys, fetcher } = keyed({ main: 400 }, "Invalid volume id", volume("abc123")));
  res = await handle(get("mode=volume&id=abc123"), { fetcher, apiKeys: ["main", "spare1"] });
  assertEquals(res.status, 404);
  assertEquals(keys, ["main"]);
  await res.body?.cancel();
});

Deno.test("every key is tried in order, and the last key's error is the answer", async () => {
  const { keys, fetcher } = keyed({ main: 429, spare1: 429, spare2: 429 });
  const res = await handle(get("mode=home"), { fetcher, apiKeys: ["main", "spare1", "spare2"] });
  assertEquals(res.status, 429);
  assertEquals(keys, ["main", "spare1", "spare2"]);
  assertEquals((await res.json()).error.code, "rate_limited");
});

Deno.test("with six keys, the sixth still answers when the first five are refused", async () => {
  const { keys, fetcher } = keyed({ k1: 429, k2: 403, k3: 429, k4: 429, k5: 403 });
  const res = await handle(get("mode=home"), { fetcher, apiKeys: ["k1", "k2", "k3", "k4", "k5", "k6"] });
  assertEquals(res.status, 200);
  assertEquals(keys, ["k1", "k2", "k3", "k4", "k5", "k6"]);
  await res.body?.cancel();
});

Deno.test("a 404 doesn't try the other keys", async () => {
  const { keys, fetcher } = keyed({ main: 404, spare1: 404 });
  const res = await handle(get("mode=volume&id=abc123"), { fetcher, apiKeys: ["main", "spare1"] });
  assertEquals(res.status, 404);
  assertEquals(keys, ["main"]);
  await res.body?.cancel();
});

Deno.test("keywords search Google's plain index, with the same options as search", async () => {
  const { calls, fetcher } = stub(200, { totalItems: 0 });
  const res = await handle(get("mode=keywords&q=" + encodeURIComponent("  time  travel ") + "&sort=newest&lang=fr&page=1"), { fetcher, emptyRetryMs: 0 });
  assertEquals(res.status, 200);
  const url = calls[0].url;
  assertEquals(url.searchParams.get("q"), "time travel");
  assertEquals(url.searchParams.get("orderBy"), "newest");
  assertEquals(url.searchParams.get("langRestrict"), "fr");
  assertEquals(url.searchParams.get("startIndex"), "20");
  const bad = await handle(get("mode=keywords&q=dune&name=x"), { fetcher });
  assertEquals(bad.status, 400);
});

// --- The Supabase cache (migration 6666) ---------------------------------------

/** An in-memory BookCache, as the function would see the tables; records how long each answer was kept. */
function memoryCache() {
  const volumes = new Map<string, { detail: BookDetail; seconds: number }>();
  const lists = new Map<string, { page: BookPage; seconds: number }>();
  const cache: BookCache = {
    getVolume: (id) => Promise.resolve(volumes.get(id)?.detail ?? null),
    putVolume: (detail, seconds) => Promise.resolve(void (seconds > 0 && volumes.set(detail.id, { detail, seconds }))),
    getList: (key) => Promise.resolve(lists.get(key)?.page ?? null),
    putList: (key, page, seconds) => Promise.resolve(void (seconds > 0 && lists.set(key, { page, seconds }))),
  };
  return { cache, volumes, lists };
}

const cacheable = { "Cache-Control": "public, max-age=86400" };

Deno.test("a book's details are kept only as long as Google's cache header allows, then served from the cache", async () => {
  const { calls, fetcher } = stub(200, volume("abc123"), cacheable);
  const { cache, volumes } = memoryCache();
  const first = await handle(get("mode=volume&id=abc123"), { fetcher, cache });
  assertEquals(first.headers.get("X-Book-Cache"), "miss");
  assertEquals(first.headers.get("Cache-Control"), "public, max-age=3600");
  assertEquals(volumes.get("abc123")?.seconds, 86400);
  const second = await handle(get("mode=volume&id=abc123"), { fetcher, cache });
  assertEquals(second.headers.get("X-Book-Cache"), "hit");
  assertEquals((await second.json()).title, "Book abc123");
  assertEquals(calls.length, 1);
});

Deno.test("nothing is kept when Google's headers don't allow it, and the browser isn't told to keep it either", async () => {
  const cases: Record<string, string>[] = [{}, { "Cache-Control": "private, max-age=600" }, { "Cache-Control": "no-store" }, { "Cache-Control": "max-age=0" }];
  for (const headers of cases) {
    const { cache, volumes, lists } = memoryCache();
    const res = await handle(get("mode=volume&id=abc123"), { fetcher: stub(200, volume("abc123"), headers).fetcher, cache });
    assertEquals(res.headers.get("Cache-Control"), "no-store");
    await handle(get("mode=genre&genre=horror"), { fetcher: stub(200, fullPage, headers).fetcher, cache });
    assertEquals(volumes.size + lists.size, 0, JSON.stringify(headers));
  }
});

Deno.test("an answer is never kept longer than 7 days, whatever Google allows", async () => {
  const { cache, lists } = memoryCache();
  await handle(get("mode=home"), { fetcher: stub(200, fullPage, { "Cache-Control": "public, max-age=31536000" }).fetcher, cache });
  assertEquals([...lists.values()][0].seconds, 7 * 24 * 60 * 60);
});

Deno.test("a kept list page is served without asking Google; an empty one is never kept", async () => {
  const { calls, fetcher } = stub(200, fullPage, cacheable);
  const { cache, lists } = memoryCache();
  await handle(get("mode=genre&genre=horror"), { fetcher, cache });
  const res = await handle(get("mode=genre&genre=horror"), { fetcher, cache });
  assertEquals(res.headers.get("X-Book-Cache"), "hit");
  assertEquals((await res.json()).items.length, 20);
  assertEquals(calls.length, 1);

  const empty = stub(200, { totalItems: 0 }, cacheable);
  await handle(get("mode=search&q=zzzz"), { fetcher: empty.fetcher, cache, emptyRetryMs: 0 });
  assertEquals([...lists.keys()].filter((k) => k.includes("zzzz")).length, 0);
});

Deno.test("a cache that throws never fails the request", async () => {
  const broken: BookCache = {
    getVolume: () => Promise.reject(new Error("db down")),
    putVolume: () => Promise.reject(new Error("db down")),
    getList: () => Promise.reject(new Error("db down")),
    putList: () => Promise.reject(new Error("db down")),
  };
  const res = await handle(get("mode=volume&id=abc123"), { fetcher: stub(200, volume("abc123"), cacheable).fetcher, cache: broken });
  assertEquals(res.status, 200);
  const list = await handle(get("mode=home"), { fetcher: stub(200, fullPage, cacheable).fetcher, cache: broken });
  assertEquals(list.status, 200);
});

// --- Open Library (members' Home for adult profiles) ---------------------------------

const olDocs = { numFound: 500, docs: Array.from({ length: 20 }, (_, i) => ({ key: `/works/OL${i + 1}W`, title: `Open ${i + 1}`, author_name: ["O. Writer"], cover_i: 1, subject: ["Fantasy"] })) };

Deno.test("source=openlibrary asks Open Library for a genre, keeps it a day, and never asks Google", async () => {
  const google = stub(200, fullPage, cacheable);
  const ol = stub(200, olDocs);
  const { cache, lists } = memoryCache();
  const res = await handle(get("mode=genre&genre=fantasy&source=openlibrary"), { fetcher: google.fetcher, openLibraryFetcher: ol.fetcher, cache });
  assertEquals(res.headers.get("X-Book-Source"), "openlibrary");
  const body = await res.json();
  assertEquals(body.items[0].id, "ol-OL1W");
  assertEquals(google.calls.length, 0);
  assertEquals(ol.calls[0].url.searchParams.get("subject"), "fantasy");
  assertEquals([...lists.values()][0].seconds, 24 * 60 * 60);
  const again = await handle(get("mode=genre&genre=fantasy&source=openlibrary"), { fetcher: google.fetcher, openLibraryFetcher: ol.fetcher, cache });
  assertEquals(again.headers.get("X-Book-Cache"), "hit");
  assertEquals(ol.calls.length, 1);
});

Deno.test("when Open Library fails or has nothing, Google answers as before", async () => {
  for (const ol of [stub(503, {}), stub(200, { numFound: 0, docs: [] })]) {
    const google = stub(200, fullPage, cacheable);
    const res = await handle(get("mode=home&source=openlibrary"), { fetcher: google.fetcher, openLibraryFetcher: ol.fetcher });
    assertEquals(res.status, 200);
    assertEquals((await res.json()).items[0].id, "id0");
    assertEquals(google.calls[0].url.searchParams.get("q"), "technology");
  }
});

Deno.test("only openlibrary is a source, and only on home and genre", async () => {
  assertEquals((await handle(get("mode=home&source=google"))).status, 400);
  assertEquals((await handle(get("mode=search&q=dune&source=openlibrary"))).status, 400);
});

Deno.test("an ol- book id opens from Open Library, not Google", async () => {
  const google = stub(200, volume("x"));
  const calls: string[] = [];
  const olFetcher = ((input: URL) => {
    const url = new URL(input);
    calls.push(url.pathname);
    const body = url.pathname === "/search.json"
      ? { numFound: 1, docs: [{ key: "/works/OL8400950W", title: "The Blade Itself", author_name: ["Joe Abercrombie"], subject: ["Fantasy"] }] }
      : { description: "Logen Ninefingers has run out of luck." };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }) as typeof fetch;
  const res = await handle(get("mode=volume&id=ol-OL8400950W"), { fetcher: google.fetcher, openLibraryFetcher: olFetcher });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.title, "The Blade Itself");
  assertEquals(body.source, "openlibrary");
  assertEquals(google.calls.length, 0);
  assertEquals(calls.sort(), ["/search.json", "/works/OL8400950W.json"]);
});

// The BISAC genres (GENRE_HEADINGS) are checked by heading: Google's subject: search is loose.
const checkedPage = {
  totalItems: 500,
  items: [
    volume("cat", { categories: ["Pets / Cats"] }),
    volume("horror", { title: "Pet Sematary", categories: ["Fiction / Horror"] }),
    volume("bare"),
    volume("dog", { categories: ["Juvenile Nonfiction / Animals / Dogs", "Pets / Dogs / General"] }),
    ...Array.from({ length: 36 }, (_, i) => volume(`more${i}`, { categories: ["Pets"] })),
  ],
};

Deno.test("a BISAC genre asks for 40 books and keeps only those filed under its heading", async () => {
  const { calls, fetcher } = stub(200, checkedPage);
  const res = await handle(get("mode=genre&genre=pets&page=1"), { fetcher });
  const body = await res.json();
  assertEquals(calls[0].url.searchParams.get("maxResults"), "40");
  assertEquals(calls[0].url.searchParams.get("startIndex"), "40");
  const ids = body.items.map((b: { id: string }) => b.id);
  assertFalse(ids.includes("horror"));
  // Filed under Pets as well as Juvenile Nonfiction, and a book with no categories at all: both kept.
  assert(ids.includes("cat") && ids.includes("dog") && ids.includes("bare"));
  assertEquals(body.items.length, 39);
  assertEquals(body.pageSize, 40);
  assert(body.hasMore);
});

Deno.test("a search narrowed to a BISAC genre is checked too; the first twenty genres aren't", async () => {
  const pets = stub(200, checkedPage);
  const narrowed = await (await handle(get("mode=search&q=cat&genre=pets"), { fetcher: pets.fetcher })).json();
  assertFalse(narrowed.items.some((b: { id: string }) => b.id === "horror"));
  assertEquals(pets.calls[0].url.searchParams.get("maxResults"), "40");
  const horror = stub(200, checkedPage);
  const broad = await (await handle(get("mode=genre&genre=horror"), { fetcher: horror.fetcher })).json();
  assertEquals(horror.calls[0].url.searchParams.get("maxResults"), "20");
  assert(broad.items.some((b: { id: string }) => b.id === "horror"));
});

Deno.test("a BISAC genre comes from Google even when Open Library is asked for, so it can be checked", async () => {
  const google = stub(200, checkedPage);
  const ol = stub(200, olDocs);
  const res = await handle(get("mode=genre&genre=pets&source=openlibrary"), { fetcher: google.fetcher, openLibraryFetcher: ol.fetcher });
  await res.body?.cancel();
  assertEquals(ol.calls.length, 0);
  assertEquals(google.calls.length, 1);
});
