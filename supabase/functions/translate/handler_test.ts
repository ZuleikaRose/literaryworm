// deno test --allow-env supabase/functions/translate — runs offline: the catalog, the text and
// Claude are all stand-ins.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { type Deps, handle, normalise, TEXT_MAX } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

const post = (body: unknown, method = "POST") =>
  new Request("http://local/translate", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const CHAPTERS = ["Il était une fois.", "C’est la nuit.\nLe vent souffle sur la mer.", "Fin."];

function deps(overrides: Partial<Deps> = {}) {
  const calls = { translate: [] as { text: string; to: string }[], limited: 0 };
  const d: Deps = {
    book: (id) => (id === "les-miserables" ? { title: "Les Misérables", author: "Victor Hugo" } : null),
    chapters: () => Promise.resolve(CHAPTERS),
    translate: (input) => {
      calls.translate.push(input);
      return Promise.resolve("It is night. The wind blows over the sea.");
    },
    rateLimit: () => {
      calls.limited++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls };
}

Deno.test("translates a passage from the chapter, across a line break and curly quotes", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ id: "les-miserables", chapter: 1, text: "C'est la nuit. Le vent souffle", to: "en" }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { translation: "It is night. The wind blows over the sea.", to: "en" });
  assertEquals(calls.translate[0].to, "English");
  assertEquals(calls.limited, 1);
});

Deno.test("refuses words that aren't in that chapter, before any Claude call", async () => {
  const { d, calls } = deps();
  const res = await handle(post({ id: "les-miserables", chapter: 0, text: "Le vent souffle", to: "en" }), d);
  assertEquals(res.status, 400);
  await res.body?.cancel();
  assertEquals(calls.translate.length, 0);
  assertEquals(calls.limited, 0);
});

Deno.test("refuses books outside the public-domain catalog, unknown languages, long passages and extra fields", async () => {
  const { d, calls } = deps();
  const statuses = [];
  for (const body of [
    { id: "dune", chapter: 0, text: "Fin.", to: "en" },
    { id: "les-miserables", chapter: 2, text: "Fin.", to: "klingon" },
    { id: "les-miserables", chapter: 2, text: "Fin.", to: "toString" },
    { id: "les-miserables", chapter: 2, text: "a".repeat(TEXT_MAX + 1), to: "en" },
    { id: "les-miserables", chapter: 9, text: "Fin.", to: "en" },
    { id: "les-miserables", chapter: 2, text: "Fin.", to: "en", extra: 1 },
  ]) {
    const res = await handle(post(body), d);
    await res.body?.cancel();
    statuses.push(res.status);
  }
  assertEquals(statuses, [404, 400, 400, 400, 400, 400]);
  assertEquals(calls.translate.length, 0);
});

Deno.test("refuses other methods", async () => {
  const { d } = deps();
  const res = await handle(post(null, "GET"), d);
  await res.body?.cancel();
  assertEquals(res.status, 405);
});

Deno.test("normalise ignores spacing, case and curly quotes", () => {
  assertEquals(normalise("  “Hello”\n  World’s "), "\"hello\" world's");
});
