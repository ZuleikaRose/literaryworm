// deno test --allow-env supabase/functions/quiz — runs offline: the catalog, the text, the kept
// quizzes and Claude are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { CHAPTER_CHARS, chapterText, checkQuiz, type Deps, handle, type Question, QUESTIONS_MAX } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const LONG = "Alice was beginning to get very tired of sitting by her sister on the bank. ".repeat(10);
const CHAPTERS = [LONG, `${LONG} The White Rabbit ran by.`, "Short."];

const post = (body: unknown, method = "POST") =>
  new Request("http://local/quiz", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const q = (question: string, answer = 0, choices = ["Alice", "The Queen", "The Duchess"]) => ({ question, choices, answer, explanation: "It says so." });
const QUIZ = { questions: [q("Who was tired?"), q("Where did she sit?", 1, ["A chair", "The bank", "A boat"]), q("Who ran by?", 2, ["A cat", "A dog", "The White Rabbit"])] };

function setup(overrides: Partial<Deps> = {}) {
  const calls = { write: 0, limited: 0, kept: 0 };
  const store = new Map<string, Question[]>();
  const deps: Deps = {
    book: (id) => (id === "alice-in-wonderland" ? { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    cached: (id, chapter) => Promise.resolve(store.get(`${id}:${chapter}`) ?? null),
    keep: (id, chapter, questions) => {
      calls.kept += 1;
      const key = `${id}:${chapter}`;
      if (!store.has(key)) store.set(key, questions);
      return Promise.resolve(store.get(key)!);
    },
    write: () => {
      calls.write += 1;
      return Promise.resolve({ quiz: QUIZ, model: "claude-haiku-5-5" });
    },
    rateLimit: () => {
      calls.limited += 1;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, calls, store };
}

Deno.test("writes a quiz once, then serves the kept one", async () => {
  const { deps, calls } = setup();
  const first = await handle(post({ id: "alice-in-wonderland", chapter: 1 }), deps);
  assertEquals(first.status, 200);
  const body = await first.json();
  assertEquals(body.questions.length, 3);
  assertEquals(body.chapter, 1);
  const second = await handle(post({ id: "alice-in-wonderland", chapter: 1 }), deps);
  assertEquals(second.status, 200);
  assertEquals(calls.write, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("refuses titles that aren't public-domain, bad fields and other methods", async () => {
  const { deps } = setup();
  assertEquals((await handle(post({ id: "dune", chapter: 0 }), deps)).status, 404);
  assertEquals((await handle(post({ id: "alice-in-wonderland", chapter: -1 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "alice-in-wonderland", chapter: 0, extra: 1 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "alice-in-wonderland", chapter: 9 }), deps)).status, 400);
  assertEquals((await handle(post(null, "GET"), deps)).status, 405);
});

Deno.test("a chapter too short for a quiz is not found", async () => {
  const { deps, calls } = setup();
  assertEquals((await handle(post({ id: "alice-in-wonderland", chapter: 2 }), deps)).status, 404);
  assertEquals(calls.write, 0);
});

Deno.test("a quiz Claude got wrong is an upstream error and isn't kept", async () => {
  const { deps, calls } = setup({ write: () => Promise.resolve({ quiz: { questions: [q("Only one?")] }, model: "m" }) });
  const res = await handle(post({ id: "alice-in-wonderland", chapter: 0 }), deps);
  assertEquals(res.status, 502);
  assertEquals(calls.kept, 0);
});

Deno.test("checkQuiz keeps well-formed questions only", () => {
  const raw = {
    questions: [
      q("Fine?"),
      q("Answer out of range?", 3),
      q("Two choices?", 0, ["Yes", "No"]),
      q("Same choices?", 0, ["Alice", "alice", "Bob"]),
      { question: "Not strings?", choices: [1, 2, 3], answer: 0, explanation: "x" },
      q("  Spaced   out?  ", 1),
      q("Third?", 2),
    ],
  };
  const out = checkQuiz(raw)!;
  assertEquals(
    out.map((x) => x.question),
    ["Fine?", "Spaced out?", "Third?"],
  );
  assertEquals(checkQuiz({ questions: [q("a"), q("b")] }), null);
  assertEquals(checkQuiz("nonsense"), null);
  const many = checkQuiz({ questions: Array.from({ length: 9 }, (_, i) => q(`Q${i}?`)) })!;
  assertEquals(many.length, QUESTIONS_MAX);
});

Deno.test("chapterText cuts a long chapter at a paragraph", () => {
  const long = `${"a".repeat(CHAPTER_CHARS - 10)}\n\n${"b".repeat(100)}`;
  const text = chapterText([long], 0);
  assert(text.length < long.length);
  assert(text.endsWith("[The rest of the chapter is left out]"));
  assertEquals(chapterText(["short"], 0), "short");
  assertEquals(chapterText([], 3), "");
});
