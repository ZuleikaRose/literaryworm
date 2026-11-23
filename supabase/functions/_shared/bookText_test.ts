// deno test --allow-env supabase/functions/_shared/bookText_test.ts — the text cache, with fetch stubbed.
import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { bookChapters, forgetTexts, TEXTS_KEPT, TEXTS_KEPT_CHARS, textsKept } from "./bookText.ts";
import { HttpError } from "./http.ts";

const MANY_BOOKS = 50;
const SHORT_BOOK = ["Chapter one.", "Chapter two."];

/** Stubs fetch with books of the given chapters; returns the ids fetched, in order. */
function stubFetch(chaptersFor: (id: string) => string[] = () => SHORT_BOOK): { fetched: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const id = decodeURIComponent(String(input).split("/texts/")[1].replace(/\.json$/, ""));
    fetched.push(id);
    return Promise.resolve(new Response(JSON.stringify({ chapters: chaptersFor(id) }), { status: 200 }));
  }) as typeof fetch;
  return { fetched, restore: () => (globalThis.fetch = original) };
}

Deno.test("keeps at most TEXTS_KEPT books, however many are asked for", async () => {
  forgetTexts();
  const { restore } = stubFetch();
  try {
    for (let i = 0; i < MANY_BOOKS; i++) {
      await bookChapters(`book-${i}`);
      assertEquals(textsKept() <= TEXTS_KEPT, true);
    }
    assertEquals(textsKept(), TEXTS_KEPT);
  } finally {
    restore();
  }
});

Deno.test("keeps no more than TEXTS_KEPT_CHARS characters of text", async () => {
  forgetTexts();
  const big = ["x".repeat(Math.ceil(TEXTS_KEPT_CHARS / 2) + 1)];
  const { restore } = stubFetch(() => big);
  try {
    await bookChapters("big-1");
    await bookChapters("big-2");
    assertEquals(textsKept(), 1);
  } finally {
    restore();
  }
});

Deno.test("a kept book isn't downloaded again, and the most recently used is kept longest", async () => {
  forgetTexts();
  const { fetched, restore } = stubFetch();
  try {
    await bookChapters("first");
    for (let i = 0; i < TEXTS_KEPT - 1; i++) await bookChapters(`other-${i}`);
    await bookChapters("first");
    await bookChapters("one-more");
    await bookChapters("first");
    assertEquals(fetched.filter((id) => id === "first").length, 1);
  } finally {
    restore();
  }
});

Deno.test("beforeDownload runs only for a download, and its refusal fetches nothing", async () => {
  forgetTexts();
  const { fetched, restore } = stubFetch();
  try {
    let checks = 0;
    const count = () => {
      checks++;
      return Promise.resolve();
    };
    await bookChapters("counted", count);
    await bookChapters("counted", count);
    assertEquals(checks, 1);
    await assertRejects(() => bookChapters("refused", () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60))));
    assertEquals(fetched, ["counted"]);
    assertEquals(textsKept(), 1);
  } finally {
    restore();
  }
});

Deno.test("a failed download isn't kept", async () => {
  forgetTexts();
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response("nope", { status: 500 }))) as typeof fetch;
  try {
    await assertRejects(() => bookChapters("broken"));
    assertEquals(textsKept(), 0);
  } finally {
    globalThis.fetch = original;
  }
});
