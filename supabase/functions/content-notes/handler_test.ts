// deno test --allow-env supabase/functions/content-notes — runs offline: the cache, the catalog
// and Claude are all stand-ins.
import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { type CatalogFacts, checkNotes, type ContentNotes, type Deps, handle, TOPICS } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

const get = (query: string, method = "GET") => new Request(`http://local/content-notes?${query}`, { method, headers: { Origin: ORIGIN } });

const dracula: CatalogFacts = { id: "dracula", title: "Dracula", author: "Bram Stoker", year: 1897, synopsis: "A vampire.", publicDomain: true };

const written: ContentNotes = {
  overall: "Gothic horror for teens and adults.",
  notes: TOPICS.map((topic) => ({ topic, level: topic === "frightening" ? "strong" : "none", note: topic === "frightening" ? "Menace and horror throughout." : "" })),
};

function deps(overrides: Partial<Deps> = {}) {
  const calls = { write: 0, stored: [] as string[], writeLimit: 0 };
  const cache = new Map<string, ContentNotes>();
  const d: Deps = {
    getCached: (id) => Promise.resolve(cache.get(id) ?? null),
    describe: (id) => (id === "dracula" ? dracula : null),
    write: () => {
      calls.write++;
      return Promise.resolve({ ...written, model: "claude-haiku-5-5" });
    },
    store: (id, n) => {
      calls.stored.push(id);
      cache.set(id, n);
      return Promise.resolve();
    },
    writeLimit: () => {
      calls.writeLimit++;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { d, calls };
}

Deno.test("the first request writes and keeps the notes; the next one reads them", async () => {
  const { d, calls } = deps();
  const first = await handle(get("id=dracula"), d);
  assertEquals(first.status, 200);
  assertEquals(await first.json(), { id: "dracula", ...written });
  const second = await handle(get("id=dracula"), d);
  await second.body?.cancel();
  assertEquals(calls.write, 1);
  assertEquals(calls.writeLimit, 1);
  assertEquals(calls.stored, ["dracula"]);
});

Deno.test("books outside the catalog, bad ids and extra parameters are refused before any Claude call", async () => {
  const { d, calls } = deps();
  const statuses = [];
  for (const q of ["id=dune-sequel", "id=bad%20id", "id=dracula&x=1", "id=dracula&id=dracula", ""]) {
    const res = await handle(get(q), d);
    await res.body?.cancel();
    statuses.push(res.status);
  }
  assertEquals(statuses, [404, 400, 400, 400, 400]);
  assertEquals(calls.write, 0);
});

Deno.test("refuses other methods", async () => {
  const { d } = deps();
  const res = await handle(get("id=dracula", "POST"), d);
  await res.body?.cancel();
  assertEquals(res.status, 405);
});

Deno.test("Claude's answer must cover every topic once with known levels, in order", () => {
  const shuffled = { ...written, notes: [...written.notes].reverse() };
  assertEquals(checkNotes(shuffled).notes.map((n) => n.topic), [...TOPICS]);
  assertThrows(() => checkNotes({ ...written, notes: written.notes.slice(1) }));
  assertThrows(() => checkNotes({ ...written, notes: [...written.notes.slice(1), written.notes[1]] }));
  assertThrows(() => checkNotes({ ...written, notes: written.notes.map((n, i) => (i ? n : { ...n, level: "extreme" })) }));
  assertThrows(() => checkNotes({ ...written, notes: written.notes.map((n, i) => (i ? n : { ...n, topic: "gore" })) }));
  assertThrows(() => checkNotes({ ...written, notes: written.notes.map((n, i) => (i ? n : { ...n, note: "x".repeat(201) })) }));
  assertThrows(() => checkNotes({ ...written, overall: "" }));
  assertThrows(() => checkNotes(null));
});
