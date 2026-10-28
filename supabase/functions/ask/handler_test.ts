// deno test --allow-env supabase/functions/ask — runs offline: the catalog, the text and Claude
// are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { CONTEXT_CHARS, contextText, type Deps, handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

const post = (body: unknown, method = "POST") =>
  new Request("http://local/ask", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const CHAPTERS = ["It is a truth universally acknowledged.", "Mr Bingley arrives.", "The ball at Meryton.", "A proposal."];

function deps(overrides: Partial<Deps> = {}) {
  const calls = { answer: [] as { chapter: number; text: string; question: string }[], limited: 0 };
  const d: Deps = {
    book: (id) => (id === "pride-and-prejudice" ? { title: "Pride and Prejudice", author: "Jane Austen" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    answer: (input) => {
      calls.answer.push(input);
      return Promise.resolve("Mr Bingley is a wealthy young man.");
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls };
}

Deno.test("answers from the text up to the reader's chapter, and no further", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1, question: "Who is Bingley?" }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { answer: "Mr Bingley is a wealthy young man." });
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assertEquals(calls.limited, 1);
  const text = calls.answer[0].text;
  assert(text.includes("Mr Bingley arrives."));
  assert(!text.includes("The ball at Meryton."), "chapter 3 must not be sent");
  assert(!text.includes("A proposal."), "chapter 4 must not be sent");
});

Deno.test("books outside the public-domain catalog are refused before any Claude call", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ id: "dune", chapter: 0, question: "Who is Paul?" }), d);
  assertEquals(res.status, 404);
  assertEquals(calls.answer.length, 0);
  assertEquals(calls.limited, 0);
});

Deno.test("rejects bad input: short or long questions, unknown fields, chapters past the end, GET", async () => {
  const { d, calls } = deps();
  for (const body of [
    { id: "pride-and-prejudice", chapter: 0, question: "Hi" },
    { id: "pride-and-prejudice", chapter: 0, question: "x".repeat(501) },
    { id: "pride-and-prejudice", chapter: -1, question: "Who is Jane?" },
    { id: "pride-and-prejudice", chapter: 0, question: "Who is Jane?", extra: true },
    { id: "bad id; drop", chapter: 0, question: "Who is Jane?" },
  ]) {
    assertEquals((await handle(post(body), d)).status, 400, JSON.stringify(body));
  }
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 4, question: "Who is Jane?" }), d)).status, 400);
  assertEquals((await handle(post(null, "GET"), d)).status, 405);
  assertEquals(calls.answer.length, 0);
});

Deno.test("rate limits and Claude's errors come back in the usual shape", async () => {
  const limited = deps({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Too many requests.", 60)) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 0, question: "Who is Jane?" }), limited.d);
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error.code, "rate_limited");
  assertEquals(limited.calls.answer.length, 0);

  const failing = deps({ answer: () => Promise.reject(new HttpError("upstream_error", "We couldn't answer that just now.")) });
  const res2 = await handle(post({ id: "pride-and-prejudice", chapter: 0, question: "Who is Jane?" }), failing.d);
  assertEquals(res2.status, 502);
});

Deno.test("long books send only the most recent text, starting at a paragraph", () => {
  const long = Array.from({ length: 10 }, (_, i) => `Paragraph of chapter ${i + 1}. ${"word ".repeat(5000)}\n\nSecond paragraph ${i + 1}.`);
  const text = contextText(long, 9);
  assert(text.length <= CONTEXT_CHARS + 40);
  assert(text.startsWith("[Earlier chapters left out]"));
  assert(text.includes("Second paragraph 10."));
  assert(!text.includes("[Chapter 1]"));
  assertEquals(contextText(CHAPTERS, 0), "[Chapter 1]\nIt is a truth universally acknowledged.");
});
