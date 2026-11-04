// deno test supabase/functions/_shared/openLibrary_test.ts
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import {
  isOpenLibraryId,
  OPEN_LIBRARY_SUBJECTS,
  shapeOpenLibraryDetail,
  shapeOpenLibraryPage,
  shapeOpenLibrarySummary,
  subjectUrl,
  USER_AGENT,
  callOpenLibrary,
} from "./openLibrary.ts";

const doc = (n: number, extra: Record<string, unknown> = {}) => ({
  key: `/works/OL${n}W`,
  title: `Book ${n}`,
  author_name: ["A. Writer"],
  first_publish_year: 2001,
  cover_i: 14543422,
  number_of_pages_median: 300,
  subject: ["Fantasy", "Fiction"],
  ...extra,
});

Deno.test("an Open Library id is ol- and a work id", () => {
  assert(isOpenLibraryId("ol-OL8400950W"));
  assertFalse(isOpenLibraryId("OL8400950W"));
  assertFalse(isOpenLibraryId("ol-OL8400950M"));
  assertFalse(isOpenLibraryId("zyTCAlFPjgYC"));
});

Deno.test("every browse genre has an Open Library subject", () => {
  assertEquals(Object.keys(OPEN_LIBRARY_SUBJECTS).length, 20);
  const url = subjectUrl("sci-fi", 2);
  assertEquals(url.searchParams.get("subject"), "science fiction");
  assertEquals(url.searchParams.get("page"), "3");
  assertEquals(url.searchParams.get("limit"), "20");
});

Deno.test("a search result becomes a book with an Open Library cover", () => {
  assertEquals(shapeOpenLibrarySummary(doc(1)), {
    id: "ol-OL1W",
    title: "Book 1",
    authors: ["A. Writer"],
    cover: "https://covers.openlibrary.org/b/id/14543422-M.jpg",
    publishedYear: "2001",
    categories: ["Fantasy", "Fiction"],
    pageCount: 300,
    source: "openlibrary",
  });
  assertEquals(shapeOpenLibrarySummary(doc(2, { cover_i: undefined }))?.cover, null);
});

Deno.test("works filed as erotica, and results without an id or title, are left out", () => {
  assertEquals(shapeOpenLibrarySummary(doc(3, { subject: ["Erotica", "Fiction"] })), null);
  assertEquals(shapeOpenLibrarySummary(doc(4, { subject: ["Fiction, erotic"] })), null);
  assertEquals(shapeOpenLibrarySummary({ key: "/books/OL1M", title: "An edition" }), null);
  assertEquals(shapeOpenLibrarySummary({ key: "/works/OL5W" }), null);
  // "Sex" alone (sex education, gender studies) isn't a reason to hide a book.
  assert(shapeOpenLibrarySummary(doc(6, { subject: ["Sex instruction for youth"] })));
});

Deno.test("a page ends like Google's: short, past the total, or twenty pages in", () => {
  const full = { numFound: 500, docs: Array.from({ length: 20 }, (_, i) => doc(i + 1)) };
  assert(shapeOpenLibraryPage(full, 0).hasMore);
  assertFalse(shapeOpenLibraryPage({ numFound: 500, docs: full.docs.slice(0, 5) }, 0).hasMore);
  assertFalse(shapeOpenLibraryPage(full, 19).hasMore);
  assertFalse(shapeOpenLibraryPage({ numFound: 30, docs: full.docs }, 1).hasMore);
});

Deno.test("a work's details come from its search entry and its record", () => {
  const detail = shapeOpenLibraryDetail(
    { docs: [doc(7, { publisher: ["Orbit", "Gollancz"], language: ["eng"] })] },
    { description: { type: "/type/text", value: "Logen has run out of luck.\r\nAgain." }, subtitle: "Book One" },
  );
  assertEquals(detail.id, "ol-OL7W");
  assertEquals(detail.description, "Logen has run out of luck.\nAgain.");
  assertEquals(detail.publisher, "Orbit");
  assertEquals(detail.language, "en");
  assertEquals(detail.subtitle, "Book One");
  assertEquals(detail.previewLink, "https://openlibrary.org/works/OL7W");
  assertEquals(detail.preview, null);
  assertFalse(detail.mature);
  // A plain-string description, and a work filed as erotica: it opens, marked mature.
  const mature = shapeOpenLibraryDetail({ docs: [doc(8, { subject: ["Erotica"] })] }, { description: "Plain." });
  assertEquals(mature.description, "Plain.");
  assert(mature.mature);
});

Deno.test("a work in several languages names none, rather than the first edition's", () => {
  const many = shapeOpenLibraryDetail({ docs: [doc(9, { language: ["ita", "ger", "fre", "eng"] })] }, {});
  assertEquals(many.language, null);
  const none = shapeOpenLibraryDetail({ docs: [doc(10, {})] }, {});
  assertEquals(none.language, null);
});

Deno.test("requests name the app and a contact, as Open Library asks", async () => {
  let ua: string | null = null;
  const fetcher = ((_: URL, init?: RequestInit) => {
    ua = new Headers(init?.headers).get("User-Agent");
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  await callOpenLibrary(new URL("https://openlibrary.org/search.json"), fetcher);
  assertEquals(ua, USER_AGENT);
  assert(USER_AGENT.includes("hello@literaryworm.com"));
});
