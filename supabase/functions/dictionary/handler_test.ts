// deno test supabase/functions/dictionary — runs offline with a stubbed dictionary.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { handle, MAX_DEFINITIONS, MAX_MEANINGS, parseWord, plainText } from "./handler.ts";

const ORIGIN = "http://localhost:5173";

function stub(status: number, body: unknown) {
  const calls: URL[] = [];
  const fetcher = ((input: URL) => {
    calls.push(new URL(input));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
  return { calls, fetcher };
}

const get = (query: string, origin = ORIGIN, method = "GET") =>
  new Request(`http://local/dictionary?${query}`, { method, headers: { Origin: origin } });

const def = (definition: string, example?: string) => ({ definition, example, synonyms: ["x"] });

const lantern = [
  {
    word: "lantern",
    phonetics: [{ text: "/ˈlæn.tən/", audio: "https://example.com/a.mp3" }],
    meanings: [
      { partOfSpeech: "noun", definitions: [def("A case for carrying a light.", "She lit the lantern."), def("A lighthouse lamp."), def("A cupola."), def("A fourth.")] },
      { partOfSpeech: "verb", definitions: [def("To provide with a lantern.")] },
    ],
    license: { name: "CC BY-SA 3.0" },
    sourceUrls: ["https://en.wiktionary.org/wiki/lantern"],
  },
  { word: "lantern", meanings: [{ partOfSpeech: "noun", definitions: [def("Another sense.")] }, { partOfSpeech: "adjective", definitions: [def("Lantern-like.")] }, { partOfSpeech: "adverb", definitions: [def("Too many parts.")] }] },
];

Deno.test("looks a word up and returns only what the reader shows", async () => {
  const { calls, fetcher } = stub(200, lantern);
  const res = await handle(get("word=Lantern"), { fetcher });
  assertEquals(res.status, 200);
  assertEquals(calls[0].href, "https://api.dictionaryapi.dev/api/v2/entries/en/lantern");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assertEquals(res.headers.get("Cache-Control"), "public, max-age=86400");
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ["meanings", "phonetic", "sourceUrl", "word"]);
  assertEquals(body.word, "lantern");
  assertEquals(body.phonetic, "/ˈlæn.tən/");
  assertEquals(body.sourceUrl, "https://en.wiktionary.org/wiki/lantern");
  assertEquals(body.meanings.length, MAX_MEANINGS);
  assertEquals(body.meanings[0].partOfSpeech, "noun");
  assertEquals(body.meanings[0].definitions.length, MAX_DEFINITIONS);
  assertEquals(body.meanings[0].definitions[0], { definition: "A case for carrying a light.", example: "She lit the lantern." });
  assertEquals(body.meanings[0].definitions[1].example, null);
  assert(!JSON.stringify(body).includes("synonyms") && !JSON.stringify(body).includes("audio"));
});

Deno.test("an unknown word is a 404 with a plain message", async () => {
  const { fetcher } = stub(404, { title: "No Definitions Found" });
  const res = await handle(get("word=florbix"), { fetcher });
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, { code: "not_found", message: 'No definition found for "florbix".' });
});

const wiktionary = {
  en: [
    { partOfSpeech: "Noun", language: "English", definitions: [
      { definition: 'A case of <a rel="mw:WikiLink" href="/wiki/translucent">translucent</a> material &amp; a flame.', examples: ["<i>The lantern</i> swung."] },
      { definition: '<span class="usage-label-sense"></span>' },
    ] },
    { partOfSpeech: "Verb", language: "English", definitions: [{ definition: "To light with a lantern." }] },
  ],
};

/** Free Dictionary answers `first`; Wiktionary answers `second`. */
function twoSources(first: () => Promise<Response>, second: () => Promise<Response>) {
  const calls: URL[] = [];
  const fetcher = ((input: URL) => {
    const url = new URL(input);
    calls.push(url);
    return url.hostname === "api.dictionaryapi.dev" ? first() : second();
  }) as typeof fetch;
  return { calls, fetcher };
}
const respond = (status: number, body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

Deno.test("falls back to Wiktionary when the Free Dictionary API is down", async () => {
  const { calls, fetcher } = twoSources(respond(530, "error code: 1033"), respond(200, wiktionary));
  const res = await handle(get("word=lantern"), { fetcher });
  assertEquals(res.status, 200);
  assertEquals(calls.map((u) => u.hostname), ["api.dictionaryapi.dev", "en.wiktionary.org"]);
  assertEquals(calls[1].pathname, "/api/rest_v1/page/definition/lantern");
  const body = await res.json();
  assertEquals(body.phonetic, null);
  assertEquals(body.sourceUrl, "https://en.wiktionary.org/wiki/lantern");
  assertEquals(body.meanings.map((m: { partOfSpeech: string }) => m.partOfSpeech), ["noun", "verb"]);
  assertEquals(body.meanings[0].definitions, [{ definition: "A case of translucent material & a flame.", example: "The lantern swung." }]);
  assertEquals(plainText("<b>x</b>&nbsp; &quot;y&quot;"), 'x "y"');
});

Deno.test("an unknown word isn't asked of Wiktionary again", async () => {
  const { calls, fetcher } = twoSources(respond(404, { title: "No Definitions Found" }), respond(200, wiktionary));
  const res = await handle(get("word=florbix"), { fetcher });
  assertEquals(res.status, 404);
  assertEquals(calls.length, 1);
});

Deno.test("the dictionaries' limits and failures become friendly errors", async () => {
  let res = await handle(get("word=sea"), { fetcher: stub(429, {}).fetcher });
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "30");
  res = await handle(get("word=sea"), { fetcher: stub(503, {}).fetcher });
  assertEquals(res.status, 502);
  const down = (() => Promise.reject(new TypeError("network"))) as typeof fetch;
  res = await handle(get("word=sea"), { fetcher: down });
  assertEquals((await res.json()).error.code, "upstream_error");
  const slow = (() => Promise.reject(new DOMException("timed out", "TimeoutError"))) as typeof fetch;
  res = await handle(get("word=sea"), { fetcher: slow });
  assertEquals(res.status, 504);
  res = await handle(get("word=sea"), { fetcher: twoSources(respond(200, [{ word: "sea", meanings: [] }]), respond(200, wiktionary)).fetcher });
  assertEquals(res.status, 404);
});

Deno.test("words are validated before anything is called", async () => {
  const { calls, fetcher } = stub(200, lantern);
  for (const q of ["", "word=", "word=two%20words", "word=x1", "word=%3Cscript%3E", `word=${"a".repeat(41)}`, "word=a&word=b", "word=a&lang=fr"]) {
    const res = await handle(get(q), { fetcher });
    assertEquals(res.status, 400, q);
    assertEquals((await res.json()).error.code, "bad_request");
  }
  assertEquals(calls.length, 0);
  assertEquals(parseWord(" Don’t "), "don't");
  assertEquals(parseWord("well-known"), "well-known");
});

Deno.test("rate limited before the dictionary is asked", async () => {
  const { calls, fetcher } = stub(200, lantern);
  const { HttpError } = await import("../_shared/http.ts");
  const res = await handle(get("word=sea"), {
    fetcher,
    rateLimit: () => Promise.reject(new HttpError("rate_limited", "Too many requests. Wait a moment and try again.", 60)),
  });
  assertEquals(res.status, 429);
  assertEquals(calls.length, 0);
});

Deno.test("CORS: preflight, unknown origins and other methods", async () => {
  const pre = await handle(get("word=sea", ORIGIN, "OPTIONS"));
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const other = await handle(get("word=sea", "https://evil.example"), { fetcher: stub(200, lantern).fetcher });
  assertEquals(other.headers.get("Access-Control-Allow-Origin"), null);
  const post = await handle(get("word=sea", ORIGIN, "POST"));
  assertEquals(post.status, 405);
});
