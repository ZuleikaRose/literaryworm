// deno test --allow-env supabase/functions/summaries — runs offline: the cache, the book
// lookup and Claude are all stand-ins.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type BookFacts, checkSummaries, type Deps, handle, type Summaries } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

const get = (query: string, origin = ORIGIN, method = "GET") =>
  new Request(`http://local/summaries?${query}`, { method, headers: { Origin: origin } });

const book: BookFacts = {
  id: "dune",
  title: "Dune",
  authors: ["Frank Herbert"],
  year: "1965",
  categories: [],
  description: "Desert planet.",
  publicDomain: false,
};

const written: Summaries = { short: "A desert epic.", detailed: "Paul Atreides goes to Arrakis.\n\nHe leads the Fremen." };

function deps(overrides: Partial<Deps> = {}) {
  const calls = { describe: 0, write: 0, stored: [] as string[], writeLimit: 0 };
  const cache = new Map<string, Summaries>();
  const d: Deps = {
    getCached: (id) => Promise.resolve(cache.get(id) ?? null),
    describe: (id) => {
      calls.describe++;
      return Promise.resolve({ ...book, id });
    },
    write: () => {
      calls.write++;
      return Promise.resolve({ ...written, model: "claude-haiku-5-5" });
    },
    store: (id, s) => {
      calls.stored.push(id);
      cache.set(id, s);
      return Promise.resolve();
    },
    writeLimit: () => {
      calls.writeLimit++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls, cache };
}

Deno.test("the first request writes and keeps the summaries; the next one reads them", async () => {
  const { d, calls } = deps();
  const first = await handle(get("id=dune"), d);
  assertEquals(first.status, 200);
  assertEquals(await first.json(), { id: "dune", ...written });
  assertEquals(first.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assertEquals(calls.stored, ["dune"]);

  const second = await handle(get("id=dune"), d);
  assertEquals((await second.json()).short, written.short);
  assertEquals(calls.write, 1);
  assertEquals(calls.writeLimit, 1, "only a new summary counts against the write limit");
});

Deno.test("ids and parameters are validated before anything is looked up", async () => {
  const { d, calls } = deps();
  for (const query of ["", "id=", "id=a%20b", `id=${"x".repeat(41)}`, "id=dune&id=dune", "id=dune&extra=1"]) {
    const res = await handle(get(query), d);
    assertEquals(res.status, 400, query);
    assertEquals((await res.json()).error.code, "bad_request");
  }
  assertEquals(calls.describe, 0);
});

Deno.test("an unknown book is a 404 and nothing is written", async () => {
  const { d, calls } = deps({ describe: () => Promise.reject(new HttpError("not_found", "We couldn't find that book.")) });
  const res = await handle(get("id=nope123"), d);
  assertEquals(res.status, 404);
  assertEquals(calls.write, 0);
});

Deno.test("past the write limit, no Claude call is made", async () => {
  const { d, calls } = deps({ writeLimit: () => Promise.reject(new HttpError("rate_limited", "Too many requests.", 3600)) });
  const res = await handle(get("id=dune"), d);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "3600");
  assertEquals(calls.write, 0);
});

Deno.test("a failed write returns the error shape and keeps nothing", async () => {
  const { d, calls } = deps({ write: () => Promise.reject(new HttpError("upstream_error", "We couldn't write a summary for this book.")) });
  const res = await handle(get("id=dune"), d);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error, { code: "upstream_error", message: "We couldn't write a summary for this book." });
  assertEquals(calls.stored, []);
});

Deno.test("Claude's answer must have both summaries within the limits", () => {
  assertEquals(checkSummaries({ short: "  A.  ", detailed: " B. " }), { short: "A.", detailed: "B." });
  for (const bad of [null, {}, { short: "A." }, { short: "", detailed: "B." }, { short: "x".repeat(601), detailed: "B." }, { short: 1, detailed: "B." }]) {
    let code = "";
    try {
      checkSummaries(bad);
    } catch (err) {
      code = (err as HttpError).code;
    }
    assertEquals(code, "upstream_error", JSON.stringify(bad));
  }
});

Deno.test("CORS: preflight, unknown origins and other methods", async () => {
  const { d } = deps();
  const pre = await handle(get("id=dune", ORIGIN, "OPTIONS"), d);
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const other = await handle(get("id=dune", "https://evil.example"), d);
  assertEquals(other.headers.get("Access-Control-Allow-Origin"), null);
  const post = await handle(get("id=dune", ORIGIN, "POST"), d);
  assertEquals(post.status, 405);
});
