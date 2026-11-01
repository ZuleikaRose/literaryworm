// deno test --allow-env supabase/functions/recaps — runs offline: the catalog, the text, the
// kept recaps and Claude are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { checkRecap, type Deps, handle, LAST_CHAPTER_MAX, type Recap, SO_FAR_MAX } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const CHAPTERS = ["It is a truth universally acknowledged.", "Mr Bingley arrives.", "The ball at Meryton.", "A proposal."];

const post = (body: unknown, method = "POST") =>
  new Request("http://local/recaps", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const WRITTEN = { so_far: "The Bennets hear that a rich young man has taken Netherfield.", last_chapter: "Mr Bingley arrives in the neighbourhood." };

function setup(overrides: Partial<Deps> = {}) {
  const calls = { write: [] as { chapter: number; text: string }[], kept: [] as { chapter: number; recap: Recap }[], limited: 0 };
  const store = new Map<string, Recap>();
  const deps: Deps = {
    book: (id) => (id === "pride-and-prejudice" ? { title: "Pride and Prejudice", author: "Jane Austen" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    cached: (id, chapter) => Promise.resolve(store.get(`${id}:${chapter}`) ?? null),
    keep: (id, chapter, recap) => {
      calls.kept.push({ chapter, recap });
      const key = `${id}:${chapter}`;
      if (!store.has(key)) store.set(key, recap);
      return Promise.resolve(store.get(key)!);
    },
    write: (input) => {
      calls.write.push(input);
      return Promise.resolve({ recap: WRITTEN, model: "claude-haiku-5-5" });
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, calls };
}

Deno.test("recaps only the chapters before the listener's, and keeps it", async () => {
  const { deps, calls } = setup();
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.chapter, 2);
  assertEquals(body.recap, { soFar: WRITTEN.so_far, lastChapter: WRITTEN.last_chapter });
  assertEquals(calls.write.length, 1);
  assert(calls.write[0].text.includes("Mr Bingley arrives."));
  assert(!calls.write[0].text.includes("The ball at Meryton."), "not the chapter the listener is starting");
  assert(!calls.write[0].text.includes("A proposal."), "nothing later");
  assertEquals(calls.kept.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("a kept recap is answered without Claude or the rate limit", async () => {
  const { deps, calls } = setup();
  await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  const again = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  assertEquals(again.status, 200);
  assertEquals(calls.write.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("only public-domain titles, chapters after the first, and only id and chapter", async () => {
  const { deps, calls } = setup();
  assertEquals((await handle(post({ id: "dune", chapter: 1 }), deps)).status, 404);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 0 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 4 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 1, extra: true }), deps)).status, 400);
  assertEquals((await handle(post({ id: "bad id!", chapter: 1 }), deps)).status, 400);
  assertEquals((await handle(post(null, "GET"), deps)).status, 405);
  assertEquals(calls.write.length, 0);
});

Deno.test("the rate limit stops a new recap before Claude is asked", async () => {
  const { deps, calls } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60)) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 429);
  assertEquals(calls.write.length, 0);
});

Deno.test("an unusable answer is an error, and nothing is kept", async () => {
  const { deps, calls } = setup({ write: () => Promise.resolve({ recap: { so_far: "Only half." }, model: "m" }) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error.code, "upstream_error");
  assertEquals(calls.kept.length, 0);
});

Deno.test("another listener's kept recap wins, and one that can't be kept is still shown", async () => {
  const theirs: Recap = { soFar: "Theirs.", lastChapter: "Theirs too." };
  const first = setup({ keep: () => Promise.resolve(theirs) });
  assertEquals((await (await handle(post({ id: "pride-and-prejudice", chapter: 1 }), first.deps)).json()).recap, theirs);
  const failing = setup({ keep: () => Promise.reject(new Error("db down")) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), failing.deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).recap.soFar, WRITTEN.so_far);
});

Deno.test("checkRecap needs both parts, tidies spaces and cuts long text at a sentence", () => {
  assertEquals(checkRecap({ so_far: "  The   Bennets.\n\n\n\nThey wait. ", last_chapter: "A ball." }), { soFar: "The Bennets.\n\nThey wait.", lastChapter: "A ball." });
  assertEquals(checkRecap({ so_far: "x", last_chapter: " " }), null);
  assertEquals(checkRecap({ so_far: 3, last_chapter: "y" }), null);
  assertEquals(checkRecap(null), null);
  const long = checkRecap({ so_far: "A sentence here. ".repeat(200), last_chapter: "z".repeat(LAST_CHAPTER_MAX + 40) })!;
  assert(long.soFar.length <= SO_FAR_MAX);
  assert(long.soFar.endsWith("."));
  assertEquals(long.lastChapter.length, LAST_CHAPTER_MAX);
  assert(long.lastChapter.endsWith("…"));
});
