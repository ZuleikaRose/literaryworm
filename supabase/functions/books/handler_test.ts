// deno test supabase/functions/books — runs offline with a stubbed Google.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
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
  const res = await handle(get("mode=home&page=1"), { fetcher, apiKey: "test-key" });
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
    ["mode=search&q=the%20hobbit", "intitle:the intitle:hobbit", "the hobbit"],
    ["mode=search&q=dune&genre=horror&sort=newest", "intitle:dune subject:horror", "dune horror"],
    ["mode=author&name=Matt%20Haig", 'inauthor:"Matt Haig"', '"Matt Haig"'],
    ["mode=search&q=dune&lang=es", "intitle:dune", "dune"],
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
  };
  for (const [genre, q] of Object.entries(expected)) {
    const { calls, fetcher } = stub(200, fullPage);
    const res = await handle(get(`mode=genre&genre=${genre}`), { fetcher });
    assertEquals(res.status, 200);
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
