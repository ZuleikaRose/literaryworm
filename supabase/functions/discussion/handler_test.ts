// deno test --allow-env supabase/functions/discussion — runs offline: the catalog, the text, the
// kept questions and Claude are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { checkQuestions, type Deps, handle, QUESTION_MAX, QUESTIONS_MAX } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const CHAPTERS = ["It is a truth universally acknowledged.", "Mr Bingley arrives.", "The ball at Meryton.", "A proposal."];

const post = (body: unknown, method = "POST") =>
  new Request("http://local/discussion", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const WRITTEN = {
  questions: [
    "Why do you think Mr Darcy refuses to dance at the ball?",
    "How does Elizabeth's reaction to Darcy's remark shape your view of her?",
    "What does the ball show about how the town judges newcomers?",
    "Mrs Bennet talks about Bingley at length. What does that tell you about her hopes?",
    "Which character did you find yourself siding with in this chapter, and why?",
    "How does the narrator's tone change the way you read the gossip?",
  ],
};

function setup(overrides: Partial<Deps> = {}) {
  const calls = { write: [] as { chapter: number; text: string }[], kept: [] as { chapter: number; questions: string[] }[], limited: 0 };
  const store = new Map<string, string[]>();
  const deps: Deps = {
    book: (id) => (id === "pride-and-prejudice" ? { title: "Pride and Prejudice", author: "Jane Austen" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    cached: (id, chapter) => Promise.resolve(store.get(`${id}:${chapter}`) ?? null),
    keep: (id, chapter, questions) => {
      calls.kept.push({ chapter, questions });
      const key = `${id}:${chapter}`;
      if (!store.has(key)) store.set(key, questions);
      return Promise.resolve(store.get(key)!);
    },
    write: (input) => {
      calls.write.push(input);
      return Promise.resolve({ questions: WRITTEN, model: "claude-haiku-5-5" });
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, calls };
}

Deno.test("asks about the text up to the end of the chapter only, and keeps the questions", async () => {
  const { deps, calls } = setup();
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.chapter, 2);
  assertEquals(body.questions, WRITTEN.questions);
  assertEquals(calls.write.length, 1);
  assert(calls.write[0].text.includes("The ball at Meryton."), "the chapter being discussed");
  assert(!calls.write[0].text.includes("A proposal."), "nothing later");
  assertEquals(calls.kept.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("chapter 1 works too, and kept questions need neither Claude nor the rate limit", async () => {
  const { deps, calls } = setup();
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 0 }), deps)).status, 200);
  const again = await handle(post({ id: "pride-and-prejudice", chapter: 0 }), deps);
  assertEquals(again.status, 200);
  assertEquals(calls.write.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("only public-domain titles, chapters the book has, and only id and chapter", async () => {
  const { deps, calls } = setup();
  assertEquals((await handle(post({ id: "dune", chapter: 1 }), deps)).status, 404);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: -1 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 4 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 1, club: "x" }), deps)).status, 400);
  assertEquals((await handle(post({ id: "bad id!", chapter: 1 }), deps)).status, 400);
  assertEquals((await handle(post(null, "GET"), deps)).status, 405);
  assertEquals(calls.write.length, 0);
});

Deno.test("the rate limit stops new questions before Claude is asked", async () => {
  const { deps, calls } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60)) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 429);
  assertEquals(calls.write.length, 0);
});

Deno.test("an unusable answer is an error, and nothing is kept", async () => {
  const { deps, calls } = setup({ write: () => Promise.resolve({ questions: { questions: ["Too few?"] }, model: "m" }) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error.code, "upstream_error");
  assertEquals(calls.kept.length, 0);
});

Deno.test("another club's kept questions win, and ones that can't be kept are still shown", async () => {
  const theirs = ["Theirs one?", "Theirs two?", "Theirs three?", "Theirs four?", "Theirs five?"].map((q) => `What about ${q}`);
  const first = setup({ keep: () => Promise.resolve(theirs) });
  assertEquals((await (await handle(post({ id: "pride-and-prejudice", chapter: 1 }), first.deps)).json()).questions, theirs);
  const failing = setup({ keep: () => Promise.reject(new Error("db down")) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), failing.deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).questions, WRITTEN.questions);
});

Deno.test("checkQuestions keeps 5 to 8 different questions, tidied, and drops the rest", () => {
  const raw = ["1. Why does he   leave?", "Why does he leave?", "Not a question.", 7, "Short?", "x".repeat(QUESTION_MAX) + "?", ...WRITTEN.questions];
  const checked = checkQuestions({ questions: raw })!;
  assertEquals(checked[0], "Why does he leave?");
  assertEquals(checked.length, QUESTIONS_MAX - 1);
  assert(checked.every((q) => q.endsWith("?") && q.length <= QUESTION_MAX));
  assertEquals(checkQuestions({ questions: WRITTEN.questions.slice(0, 4) }), null);
  assertEquals(checkQuestions({ questions: "Why?" }), null);
  assertEquals(checkQuestions(null), null);
  const many = Array.from({ length: 12 }, (_, i) => `What does moment number ${i} tell you about the hero?`);
  assertEquals(checkQuestions({ questions: many })!.length, QUESTIONS_MAX);
});
