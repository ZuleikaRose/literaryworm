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
  const body = await res.json();
  assertEquals(body.items.length, 20);
  assert(body.hasMore);
  assertEquals(body.items[0].cover, "https://books.google.com/books/content?id=x&zoom=1");
  assertFalse(JSON.stringify(body).includes("test-key"), "API key must never reach the browser");
  assertEquals(Object.keys(body.items[0]).sort(), ["authors", "categories", "cover", "id", "publishedYear", "title"]);
});

Deno.test("search is title-only", async () => {
  const { calls, fetcher } = stub(200, { totalItems: 0 });
  const res = await handle(get("mode=search&q=" + encodeURIComponent("  the  hobbit ")), { fetcher });
  assertEquals(res.status, 200);
  assertEquals(calls[0].url.searchParams.get("q"), "intitle:the intitle:hobbit");
  const body = await res.json();
  assertEquals(body.items, []);
  assertFalse(body.hasMore);
});

Deno.test("each genre maps to a subject query", async () => {
  const expected: Record<string, string> = {
    adventure: "subject:adventure",
    technology: "subject:technology",
    horror: "subject:horror",
    "sci-fi": 'subject:"science fiction"',
    fiction: "subject:fiction",
    "non-fiction": "subject:nonfiction",
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
    "mode=genre&genre=romance",                      // not a required genre
    "mode=volume&id=..%2Fetc",                       // bad id
    "mode=nope",
    "mode=home&key=abc",                             // unexpected parameter
    "mode=home&page=1&page=2",                       // repeated parameter
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

  res = await handle(get("mode=home"), stub(503, {}));
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error.code, "upstream_error");

  const timeout = (() => Promise.reject(new DOMException("timed out", "TimeoutError"))) as typeof fetch;
  res = await handle(get("mode=home"), { fetcher: timeout });
  assertEquals(res.status, 504);
  assertEquals((await res.json()).error.code, "upstream_timeout");
});

Deno.test("volume details strip HTML and handle missing cover and description", async () => {
  let res = await handle(
    get("mode=volume&id=abc123"),
    stub(200, volume("abc123", { description: "<p>Hello <b>world</b> &amp; more</p>", pageCount: 320, publisher: "Pub" })),
  );
  let body = await res.json();
  assertEquals(body.description, "Hello world & more");
  assertEquals(body.pageCount, 320);

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
