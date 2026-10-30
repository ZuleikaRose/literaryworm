// deno test --allow-env supabase/functions/author-news — runs offline with a stubbed database, Google and Mailgun.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { authorNewsEmail, type Email, type NewBook } from "./email.ts";
import { AUTHORS_PER_RUN, BOOKS_PER_AUTHOR, type Deps, type FoundBook, handle, newBooks } from "./handler.ts";

const SECRET = "s3cret-value";
const SITE = "https://www.literaryworm.com";
const NOW = new Date("2026-10-30T08:30:00Z");

const volume = (id: string, title: string, publishedDate: string | undefined, authors: string[] = ["Matt Haig"]) => ({
  id,
  volumeInfo: { title, authors, publishedDate },
});

function newBook(overrides: Partial<NewBook> = {}): NewBook {
  return {
    userId: "user-a",
    email: "reader@example.com",
    accountName: "Ada",
    profileId: "profile-1",
    profileName: "Ada",
    volumeId: "vol1",
    title: "The Life Impossible",
    author: "Matt Haig",
    published: "2026-10-14",
    ...overrides,
  };
}

function setup(overrides: Partial<Deps> = {}) {
  const state = {
    asked: [] as string[],
    recorded: [] as { name: string; books: FoundBook[] }[],
    sent: [] as Email[],
    released: [] as NewBook[],
    checkedWith: 0,
    claimedWith: 0,
  };
  const deps: Deps = {
    secret: () => Promise.resolve(SECRET),
    authorsToCheck: (max) => {
      state.checkedWith = max;
      return Promise.resolve(["Matt Haig", "Ann Patchett"]);
    },
    searchAuthor: (name) => {
      state.asked.push(name);
      return Promise.resolve({ items: [volume("vol1", "The Life Impossible", "2026-10-14", [name])] });
    },
    record: (name, books) => {
      state.recorded.push({ name, books });
      return Promise.resolve(books.length * 2);
    },
    claim: (max) => {
      state.claimedWith = max;
      return Promise.resolve([newBook()]);
    },
    release: (b) => {
      state.released.push(...b);
      return Promise.resolve();
    },
    send: (email) => {
      state.sent.push(email);
      return Promise.resolve();
    },
    siteOrigin: SITE,
    now: () => NOW,
    ...overrides,
  };
  return { deps, state };
}

const post = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  new Request("http://localhost/author-news", {
    method: "POST",
    headers: auth ? { Authorization: auth, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("refuses a call without the secret, or when Vault has none", async () => {
  const { deps, state } = setup();
  assertEquals((await handle(post({ task: "check" }, null), deps)).status, 401);
  assertEquals((await handle(post({ task: "check" }, "Bearer wrong"), deps)).status, 401);
  const { deps: noSecret } = setup({ secret: () => Promise.resolve(null) });
  assertEquals((await handle(post({ task: "check" }, "Bearer "), noSecret)).status, 401);
  assertEquals(state.checkedWith, 0);
});

Deno.test("only POST, and only a known task", async () => {
  const { deps, state } = setup();
  assertEquals((await handle(new Request("http://localhost/author-news"), deps)).status, 405);
  assertEquals((await handle(post({}), deps)).status, 400);
  assertEquals((await handle(post({ task: "everything" }), deps)).status, 400);
  assertEquals((await handle(post({ task: "check", extra: 1 }), deps)).status, 400);
  assertEquals((await handle(post(null), deps)).status, 400);
  assertEquals(state.asked.length, 0);
});

Deno.test("check asks Google about each author due and records what's new", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ task: "check" }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { authors: 2, checked: 2, added: 4 });
  assertEquals(state.checkedWith, AUTHORS_PER_RUN);
  assertEquals(state.asked, ["Matt Haig", "Ann Patchett"]);
  assertEquals(state.recorded[0], { name: "Matt Haig", books: [{ id: "vol1", title: "The Life Impossible", published: "2026-10-14" }] });
  assertEquals(state.sent.length, 0);
});

Deno.test("an author Google fails on isn't recorded, so it's asked about again next time", async () => {
  const { deps, state } = setup({
    searchAuthor: (name) => (name === "Matt Haig" ? Promise.reject(new Error("503")) : Promise.resolve({ items: [] })),
  });
  const res = await handle(post({ task: "check" }), deps);
  assertEquals(await res.json(), { authors: 2, checked: 1, added: 0 });
  assertEquals(state.recorded.map((r) => r.name), ["Ann Patchett"]);
});

Deno.test("a run stops asking Google after three failures in a row", async () => {
  let asked = 0;
  const { deps } = setup({
    authorsToCheck: () => Promise.resolve(["A", "B", "C", "D", "E"]),
    searchAuthor: () => {
      asked++;
      return Promise.reject(new Error("429"));
    },
  });
  const res = await handle(post({ task: "check" }), deps);
  assertEquals((await res.json()).checked, 0);
  assertEquals(asked, 3);
});

Deno.test("email sends one email per account and hands back the books of one that fails", async () => {
  const books = [newBook(), newBook({ volumeId: "vol2", title: "Another" }), newBook({ userId: "user-b", email: "b@example.com", volumeId: "vol3" })];
  const { deps, state } = setup({
    claim: () => Promise.resolve(books),
    send: (email) => (email.to === "b@example.com" ? Promise.reject(new Error("Mailgun answered 500")) : (state.sent.push(email), Promise.resolve())),
  });
  const res = await handle(post({ task: "email" }), deps);
  assertEquals(await res.json(), { accounts: 2, sent: 1, failed: 1 });
  assertEquals(state.sent.length, 1);
  assertEquals(state.sent[0].subject, "2 new books from authors you follow");
  assertEquals(state.released.map((b) => b.volumeId), ["vol3"]);
  assertEquals(state.asked.length, 0);
});

Deno.test("an error before anything is sent is a 500 in the usual shape", async () => {
  const { deps } = setup({ claim: () => Promise.reject(new Error("db down")) });
  const res = await handle(post({ task: "email" }), deps);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.code, "server_error");
});

Deno.test("newBooks keeps this author's books from the last 30 days, newest first, one per title", () => {
  const body = {
    items: [
      volume("old", "Old Book", "2026-08-01"),
      volume("a1", "The Life Impossible", "2026-10-14"),
      volume("a2", "The Life Impossible", "2026-10-15"), // another edition
      volume("soon", "Not Out Yet", "2026-11-20"),
      volume("month", "Month Only", "2026-10"),
      volume("year", "Year Only", "2026"),
      volume("other", "Someone Else's", "2026-10-20", ["Matt Haigh"]),
      volume("co", "Written Together", "2026-10-02", ["Someone", "matt  haig"]),
      volume("bad id!", "Bad Id", "2026-10-20"),
      volume("nodate", "No Date", undefined),
      { id: "x", volumeInfo: {} },
      "junk",
    ],
  };
  assertEquals(newBooks(body, "Matt Haig", NOW), [
    { id: "a1", title: "The Life Impossible", published: "2026-10-14" },
    { id: "co", title: "Written Together", published: "2026-10-02" },
    { id: "month", title: "Month Only", published: "2026-10" },
  ]);
});

Deno.test("newBooks counts today and the 30th day back, but not the 31st", () => {
  const body = { items: [volume("t", "Today", "2026-10-30"), volume("d30", "Thirty", "2026-09-30"), volume("d31", "Thirty-one", "2026-09-29")] };
  assertEquals(newBooks(body, "Matt Haig", NOW).map((b) => b.id), ["t", "d30"]);
});

Deno.test("newBooks has nothing for an empty or odd answer, and keeps a few books at most", () => {
  assertEquals(newBooks({}, "Matt Haig", NOW), []);
  assertEquals(newBooks(null, "Matt Haig", NOW), []);
  assertEquals(newBooks({ items: "nope" }, "Matt Haig", NOW), []);
  const many = { items: Array.from({ length: 12 }, (_, i) => volume(`v${i}`, `Book ${i}`, "2026-10-20")) };
  assertEquals(newBooks(many, "Matt Haig", NOW).length, BOOKS_PER_AUTHOR);
});

Deno.test("the email names one book in the subject and links to it", () => {
  const email = authorNewsEmail([newBook()], SITE);
  assertEquals(email.to, "reader@example.com");
  assertEquals(email.subject, "New from Matt Haig: The Life Impossible");
  assertStringIncludes(email.text, `${SITE}/books/vol1`);
  assertStringIncludes(email.text, `${SITE}/account#preferences`);
  assertStringIncludes(email.html, "Turn these emails off");
});

Deno.test("the email lists a book two profiles follow once, naming both", () => {
  const email = authorNewsEmail([newBook(), newBook({ profileId: "profile-2", profileName: "Sam" })], SITE);
  assertEquals(email.subject, "New from Matt Haig: The Life Impossible");
  assertStringIncludes(email.text, "(followed by Ada and Sam)");
  assertEquals(email.text.match(/The Life Impossible by/g)?.length, 1);
});

Deno.test("the email doesn't name the profile when only one has new books", () => {
  const email = authorNewsEmail([newBook(), newBook({ volumeId: "vol2", title: "Another" })], SITE);
  assertFalse(email.text.includes("followed by"));
});

Deno.test("the email escapes titles and names in HTML", () => {
  const email = authorNewsEmail([newBook({ title: `<script>"x"</script>`, author: "A & B", accountName: "<b>Ada</b>" })], SITE);
  assertFalse(email.html.includes("<script>"));
  assertStringIncludes(email.html, "&lt;script&gt;");
  assertStringIncludes(email.html, "A &amp; B");
  assert(!email.html.includes("<b>Ada</b>"));
});
