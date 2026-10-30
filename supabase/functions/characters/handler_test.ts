// deno test --allow-env supabase/functions/characters — runs offline: the catalog, the text,
// the kept lists and Claude are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type Character, CHARACTERS_MAX, checkCharacters, type Deps, DESCRIPTION_MAX, handle } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const CHAPTERS = ["It is a truth universally acknowledged.", "Mr Bingley arrives.", "The ball at Meryton.", "A proposal."];

const post = (body: unknown, method = "POST") =>
  new Request("http://local/characters", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const LIST = {
  characters: [
    { name: "Mr Bingley", description: "A wealthy young man who has taken Netherfield.", first_chapter: 2 },
    { name: "Elizabeth Bennet", description: "The second Bennet daughter, quick and witty.", first_chapter: 1 },
  ],
};

function setup(overrides: Partial<Deps> = {}) {
  const calls = { write: [] as { chapter: number; text: string }[], kept: [] as { chapter: number; characters: Character[] }[], limited: 0 };
  const store = new Map<string, Character[]>();
  const deps: Deps = {
    book: (id) => (id === "pride-and-prejudice" ? { title: "Pride and Prejudice", author: "Jane Austen" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    cached: (id, chapter) => Promise.resolve(store.get(`${id}:${chapter}`) ?? null),
    keep: (id, chapter, characters) => {
      calls.kept.push({ chapter, characters });
      const key = `${id}:${chapter}`;
      if (!store.has(key)) store.set(key, characters);
      return Promise.resolve(store.get(key)!);
    },
    write: (input) => {
      calls.write.push(input);
      return Promise.resolve({ characters: LIST, model: "claude-haiku-5-5" });
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, calls };
}

Deno.test("writes the list from the text up to the reader's chapter, keeps it, and orders it by first appearance", async () => {
  const { deps, calls } = setup();
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.chapter, 1);
  assertEquals(body.characters.map((c: Character) => c.name), ["Elizabeth Bennet", "Mr Bingley"]);
  assertEquals(calls.write.length, 1);
  assert(calls.write[0].text.includes("Mr Bingley arrives."));
  assert(!calls.write[0].text.includes("The ball at Meryton."), "no text past the reader's chapter");
  assertEquals(calls.kept.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("a kept list is answered without Claude or the rate limit", async () => {
  const { deps, calls } = setup();
  await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  const again = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  assertEquals(again.status, 200);
  assertEquals(calls.write.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("only public-domain titles, valid chapters, and only id and chapter", async () => {
  const { deps, calls } = setup();
  assertEquals((await handle(post({ id: "dune", chapter: 0 }), deps)).status, 404);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 4 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: -1 }), deps)).status, 400);
  assertEquals((await handle(post({ id: "pride-and-prejudice", chapter: 1, extra: true }), deps)).status, 400);
  assertEquals((await handle(post({ id: "bad id!", chapter: 1 }), deps)).status, 400);
  assertEquals((await handle(post(null, "GET"), deps)).status, 405);
  assertEquals(calls.write.length, 0);
});

Deno.test("the rate limit stops a new list before Claude is asked", async () => {
  const { deps, calls } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60)) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 429);
  assertEquals(calls.write.length, 0);
});

Deno.test("an empty or unusable answer is an error, and nothing is kept", async () => {
  const { deps, calls } = setup({ write: () => Promise.resolve({ characters: { characters: [] }, model: "m" }) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 2 }), deps);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error.code, "upstream_error");
  assertEquals(calls.kept.length, 0);
});

Deno.test("when another reader's list was kept first, that's the one shown", async () => {
  const theirs: Character[] = [{ name: "Jane Bennet", description: "The eldest.", firstChapter: 1 }];
  const { deps } = setup({ keep: () => Promise.resolve(theirs) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  assertEquals((await res.json()).characters, theirs);
});

Deno.test("a list that can't be kept is still shown", async () => {
  const { deps } = setup({ keep: () => Promise.reject(new Error("db down")) });
  const res = await handle(post({ id: "pride-and-prejudice", chapter: 1 }), deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).characters.length, 2);
});

Deno.test("checkCharacters drops anyone met after the reader's chapter: no spoilers", () => {
  const raw = {
    characters: [
      { name: "Elizabeth Bennet", description: "Witty.", first_chapter: 1 },
      { name: "Mr Wickham", description: "Charming officer.", first_chapter: 15 },
      { name: "Mr Collins", description: "A clergyman.", first_chapter: 3 },
    ],
  };
  assertEquals(checkCharacters(raw, 1).map((c) => c.name), ["Elizabeth Bennet"]);
  assertEquals(checkCharacters(raw, 2).map((c) => c.name), ["Elizabeth Bennet", "Mr Collins"]);
});

Deno.test("checkCharacters keeps well-formed entries only, once each, within the limits", () => {
  const raw = {
    characters: [
      { name: "  Jane   Bennet ", description: "The eldest.\n Kind.", first_chapter: 1 },
      { name: "jane bennet", description: "Again.", first_chapter: 1 },
      { name: "", description: "No name.", first_chapter: 1 },
      { name: "No description", description: " ", first_chapter: 1 },
      { name: "Bad chapter", description: "x", first_chapter: 0 },
      { name: "Wrong types", description: 3, first_chapter: "1" },
      "junk",
      null,
      { name: "Long", description: "y".repeat(DESCRIPTION_MAX + 50), first_chapter: 1 },
    ],
  };
  const out = checkCharacters(raw, 0);
  assertEquals(out.map((c) => c.name), ["Jane Bennet", "Long"]);
  assertEquals(out[0].description, "The eldest. Kind.");
  assertEquals(out[1].description.length, DESCRIPTION_MAX);
  assertEquals(checkCharacters(null, 3), []);
  assertEquals(checkCharacters({ characters: "nope" }, 3), []);
  const many = { characters: Array.from({ length: 60 }, (_, i) => ({ name: `P${i}`, description: "d", first_chapter: 1 })) };
  assertEquals(checkCharacters(many, 0).length, CHARACTERS_MAX);
});
