// deno test --allow-env supabase/functions/xray — runs offline: the catalog, the text, the kept
// X-Rays and Claude are all stand-ins.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { ALIASES_MAX, checkXRay, type Deps, DESCRIPTION_MAX, firstChapterNaming, handle, KIND_MAX, mentionPattern, type XRay } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const BOOK_ID = "pride-and-prejudice";
const MODEL = "claude-haiku-5-5";
const CHAPTERS = [
  "It is a truth universally acknowledged. Mrs. Bennet speaks of Netherfield Park.",
  "Mr. Bingley arrives at Netherfield. Elizabeth Bennet laughs. The entail worries her mother.",
  "The ball at Meryton. Lizzy dances.",
  "A proposal from Mr. Collins at Longbourn.",
];
const READER_CHAPTER = 1;

const post = (body: unknown, method = "POST") =>
  new Request("http://local/xray", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const WRITTEN = {
  people: [
    { name: "Mr. Bingley", aliases: [], description: "A wealthy young man who has taken Netherfield." },
    { name: "Elizabeth Bennet", aliases: ["Lizzy"], description: "The second Bennet daughter, quick and witty." },
    { name: "Mr. Collins", aliases: [], description: "Someone not met until later." },
  ],
  places: [{ name: "Netherfield Park", aliases: ["Netherfield"], description: "A large house near the Bennets'." }],
  terms: [{ name: "the entail", aliases: [], description: "The arrangement that decides who inherits the Bennets' house." }],
};

function setup(overrides: Partial<Deps> = {}) {
  const calls = { write: [] as { chapter: number; text: string }[], kept: [] as { chapter: number; xray: XRay }[], limited: 0 };
  const store = new Map<string, XRay>();
  const deps: Deps = {
    book: (id) => (id === BOOK_ID ? { title: "Pride and Prejudice", author: "Jane Austen" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    cached: (id, chapter) => Promise.resolve(store.get(`${id}:${chapter}`) ?? null),
    keep: (id, chapter, xray) => {
      calls.kept.push({ chapter, xray });
      const key = `${id}:${chapter}`;
      if (!store.has(key)) store.set(key, xray);
      return Promise.resolve(store.get(key)!);
    },
    write: (input) => {
      calls.write.push(input);
      return Promise.resolve({ xray: WRITTEN, model: MODEL });
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, calls, store };
}

Deno.test("writes the X-Ray from the text up to the reader's chapter and keeps it", async () => {
  const { deps, calls } = setup();
  const res = await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.chapter, READER_CHAPTER);
  // Both first named in chapter 2: Claude's order (most important first) is kept between them.
  assertEquals(body.people.map((p: { name: string }) => p.name), ["Mr. Bingley", "Elizabeth Bennet"]);
  assertEquals(body.places.map((p: { name: string }) => p.name), ["Netherfield Park"]);
  assertEquals(body.terms.map((p: { name: string }) => p.name), ["the entail"]);
  assertEquals(calls.write.length, 1);
  assert(calls.write[0].text.includes("Mr. Bingley arrives"));
  assert(!calls.write[0].text.includes("The ball at Meryton."), "no text past the reader's chapter");
  assertEquals(calls.kept.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("drops anyone the text up to the reader's chapter never names, whatever Claude says", async () => {
  const { deps } = setup();
  const body = await (await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps)).json();
  assert(!body.people.some((p: { name: string }) => p.name === "Mr. Collins"), "Mr. Collins is only named in chapter 4");
});

Deno.test("serves a kept X-Ray without asking Claude or counting it against the limits", async () => {
  const { deps, calls } = setup();
  await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  const again = await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  assertEquals(again.status, 200);
  assertEquals(calls.write.length, 1);
  assertEquals(calls.limited, 1);
});

Deno.test("returns the X-Ray already kept when another reader's was saved first", async () => {
  const first: XRay = { people: [{ name: "Elizabeth Bennet", description: "Kept first.", firstChapter: 2, aliases: [] }], places: [], terms: [] };
  const { deps } = setup({ keep: () => Promise.resolve(first) });
  const body = await (await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps)).json();
  assertEquals(body.people, first.people);
});

Deno.test("still shows a new X-Ray when keeping it fails", async () => {
  const { deps } = setup({ keep: () => Promise.reject(new Error("database down")) });
  const res = await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  assertEquals(res.status, 200);
});

Deno.test("refuses titles that aren't public-domain catalog books", async () => {
  const { deps, calls } = setup();
  const res = await handle(post({ id: "u-0123456789abcdef0123456789abcdef", chapter: 0 }), deps);
  assertEquals(res.status, 404);
  assertEquals(calls.write.length, 0);
});

Deno.test("refuses a chapter past the end of the book, unexpected keys and bad input", async () => {
  const { deps } = setup();
  assertEquals((await handle(post({ id: BOOK_ID, chapter: CHAPTERS.length }), deps)).status, 400);
  assertEquals((await handle(post({ id: BOOK_ID, chapter: 0, text: "extra" }), deps)).status, 400);
  assertEquals((await handle(post({ id: BOOK_ID, chapter: -1 }), deps)).status, 400);
  assertEquals((await handle(post({ id: BOOK_ID, chapter: "1" }), deps)).status, 400);
  assertEquals((await handle(post({ id: BOOK_ID }), deps)).status, 400);
  assertEquals((await handle(post(null), deps)).status, 400);
  assertEquals((await handle(post({}, "GET"), deps)).status, 405);
});

Deno.test("answers the rate limit's refusal without asking Claude", async () => {
  const { deps, calls } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60)) });
  const res = await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  assertEquals(res.status, 429);
  assertEquals(calls.write.length, 0);
});

Deno.test("reports an empty answer from Claude as an upstream error and keeps nothing", async () => {
  const { deps, calls } = setup({ write: () => Promise.resolve({ xray: { people: [], places: [], terms: [] }, model: MODEL }) });
  const res = await handle(post({ id: BOOK_ID, chapter: READER_CHAPTER }), deps);
  assertEquals(res.status, 502);
  assertEquals(calls.kept.length, 0);
});

Deno.test("answers the CORS preflight", async () => {
  const { deps } = setup();
  const res = await handle(new Request("http://local/xray", { method: "OPTIONS", headers: { Origin: ORIGIN } }), deps);
  assert(res.status === 204 || res.status === 200);
});

Deno.test("checkXRay: takes each first chapter from the text, aliases included", () => {
  const xray = checkXRay(WRITTEN, CHAPTERS.slice(0, READER_CHAPTER + 1));
  const elizabeth = xray.people.find((p) => p.name === "Elizabeth Bennet")!;
  assertEquals(elizabeth.firstChapter, 2);
  // "Lizzy" first appears in chapter 3, past the reader, so it isn't kept.
  assertEquals(elizabeth.aliases, []);
  const netherfield = xray.places[0];
  assertEquals(netherfield.firstChapter, 1);
  assertEquals(netherfield.aliases, ["Netherfield"]);
});

Deno.test("checkXRay: keeps each name once across kinds, trims to the limits and skips malformed entries", () => {
  const long = "x".repeat(DESCRIPTION_MAX + 50);
  const raw = {
    people: [
      { name: "Elizabeth Bennet", aliases: ["Elizabeth", "Elizabeth", "Bennet", "Mrs.", "Elizabeth Bennet", "Mr."], description: long },
      { name: "  ", aliases: [], description: "No name." },
      { name: "Mr. Bingley", description: "" },
      "not an entry",
      null,
    ],
    places: [{ name: "elizabeth bennet", aliases: [], description: "The same name again." }],
    terms: "not a list",
  };
  const xray = checkXRay(raw, CHAPTERS);
  assertEquals(xray.people.length, 1);
  assertEquals(xray.people[0].description.length, DESCRIPTION_MAX);
  assertEquals(xray.people[0].aliases, ["Elizabeth", "Bennet", "Mrs.", "Mr."].slice(0, ALIASES_MAX));
  assertEquals(xray.places, []);
  assertEquals(xray.terms, []);
});

Deno.test("checkXRay: an empty or missing answer is an empty X-Ray", () => {
  assertEquals(checkXRay(null, CHAPTERS), { people: [], places: [], terms: [] });
  assertEquals(checkXRay({}, CHAPTERS), { people: [], places: [], terms: [] });
  assertEquals(checkXRay(WRITTEN, []), { people: [], places: [], terms: [] });
});

Deno.test("checkXRay: keeps at most each kind's limit", () => {
  const text = Array.from({ length: KIND_MAX.places + 5 }, (_, i) => `Town${i}`).join(" ");
  const raw = { people: [], places: Array.from({ length: KIND_MAX.places + 5 }, (_, i) => ({ name: `Town${i}`, aliases: [], description: "A town." })), terms: [] };
  assertEquals(checkXRay(raw, [text]).places.length, KIND_MAX.places);
});

Deno.test("mentionPattern: whole words only, small first letters found at a sentence's start", () => {
  assert(mentionPattern("Jane").test("Jane smiled."));
  assert(!mentionPattern("Jane").test("Janet smiled."));
  assert(!mentionPattern("Jane").test("jane smiled."));
  assert(mentionPattern("the entail").test("The entail was a worry."));
  assert(mentionPattern("Netherfield Park").test("at Netherfield\nPark today"));
  assert(mentionPattern("Mr. Darcy").test("said Mr. Darcy."));
  assert(!mentionPattern("Mr. Darcy").test("said MrX Darcy."));
  assert(mentionPattern("Ἀθῆναι").test("ἐν Ἀθῆναι."));
});

Deno.test("firstChapterNaming: the 1-based chapter of the first mention, or null", () => {
  assertEquals(firstChapterNaming(CHAPTERS, ["Meryton"]), 3);
  assertEquals(firstChapterNaming(CHAPTERS, ["Lizzy", "Elizabeth Bennet"]), 2);
  assertEquals(firstChapterNaming(CHAPTERS, ["Pemberley"]), null);
  assertEquals(firstChapterNaming([], ["Meryton"]), null);
});

Deno.test("checkXRay: drops an alias that holds another entry's name, or that's a phrase, not a name", () => {
  const text = "Mrs. Bennet said, my dear Mr. Bennet, how can you? Mr. Bennet smiled. The lady of the house at Longbourn agreed.";
  const raw = {
    people: [
      { name: "Mrs. Bennet", aliases: ["my dear Mr. Bennet", "The lady of the house at Longbourn"], description: "His wife." },
      { name: "Mr. Bennet", aliases: [], description: "Her husband." },
    ],
    places: [],
    terms: [],
  };
  const xray = checkXRay(raw, [text]);
  assertEquals(xray.people.find((p) => p.name === "Mrs. Bennet")!.aliases, []);
});

Deno.test("checkXRay: a person's or place's alias is a name, with a capital; a term's needn't be", () => {
  const text = "Mrs. Bennet, my dear, said Mama. The entail, that entailment, worried her.";
  const raw = {
    people: [{ name: "Mrs. Bennet", aliases: ["my dear", "Mama"], description: "His wife." }],
    places: [],
    terms: [{ name: "entail", aliases: ["entailment"], description: "Who inherits." }],
  };
  const xray = checkXRay(raw, [text]);
  assertEquals(xray.people[0].aliases, ["Mama"]);
  assertEquals(xray.terms[0].aliases, ["entailment"]);
});
