// deno test --allow-env supabase/functions/club-digest — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { byClub, chapterLine, clubPostsEmail, type Email, names } from "./email.ts";
import { BATCH, type Deps, type DigestRow, handle } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";

const row = (userId: string, over: Partial<DigestRow> = {}): DigestRow => ({
  userId,
  email: `${userId}@example.com`,
  name: userId === "ada" ? "Ada" : null,
  clubId: "club-1",
  clubName: "Sunday Classics",
  bookId: "pride-and-prejudice",
  chapterIndex: 2,
  posts: 2,
  authors: ["Ben", "Cal"],
  wasThrough: "2026-10-29T17:00:00.000Z",
  ...over,
});

function setup(batches: DigestRow[][], overrides: Partial<Deps> = {}) {
  const state = { sent: [] as { email: Email; unsubscribe: string }[], released: [] as [string, string | null][], claims: 0 };
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: () => Promise.resolve(batches[state.claims++] ?? []),
    release: (id, was) => {
      state.released.push([id, was]);
      return Promise.resolve();
    },
    unsubscribeLink: (userId) => Promise.resolve(`${SITE}/unsubscribe?t=${userId}.sig&l=club-posts`),
    send: (email, unsubscribe) => {
      state.sent.push({ email, unsubscribe });
      return Promise.resolve();
    },
    siteOrigin: SITE,
    ...overrides,
  };
  return { state, deps };
}

const run = (deps: Deps, auth = `Bearer ${KEY}`) =>
  handle(new Request("http://local/club-digest", { method: "POST", headers: { Authorization: auth } }), deps);

Deno.test("only the cron job's key is accepted", async () => {
  const { state, deps } = setup([[row("ada")]]);
  assertEquals((await run(deps, "Bearer wrong")).status, 401);
  assertEquals((await run(setup([], { secret: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals((await handle(new Request("http://local/club-digest"), deps)).status, 405);
  assertEquals(state.sent.length, 0);
});

Deno.test("one email per account, with every club and chapter in it", async () => {
  const { state, deps } = setup([[
    row("ada"),
    row("ada", { chapterIndex: 0, posts: 1, authors: ["Ben"] }),
    row("ada", { clubId: "club-2", clubName: "Night Owls", bookId: "dracula", chapterIndex: 4, posts: 1, authors: ["Dee"] }),
    row("ben"),
  ]]);
  assertEquals(await (await run(deps)).json(), { accounts: 2, sent: 2, failed: 0 });
  assertEquals(state.sent.map((s) => s.email.to), ["ada@example.com", "ben@example.com"]);
  const ada = state.sent[0].email;
  assertEquals(ada.subject, "New posts in 2 of your book clubs");
  assertStringIncludes(ada.text, "Hi Ada,");
  assertStringIncludes(ada.text, "There are 4 new posts");
  assertStringIncludes(ada.text, "Chapter 1: 1 post from Ben\nChapter 3: 2 posts from Ben and Cal");
  assertStringIncludes(ada.text, "Chapter 5: 1 post from Dee");
  assertStringIncludes(ada.html, `${SITE}/library?view=clubs`);
  assertEquals(state.sent[1].email.subject, "New posts in Sunday Classics");
  assertStringIncludes(state.sent[1].email.text, "Hi,");
  assertStringIncludes(state.sent[1].email.html, `${SITE}/clubs/club-1`);
  assertEquals(state.released, []);
});

Deno.test("a failed email hands that account back to the time it had", async () => {
  const { state, deps } = setup([[row("ada"), row("ben", { wasThrough: null })]], {
    send: (email) => (email.to.startsWith("ben") ? Promise.reject(new Error("refused")) : Promise.resolve()),
  });
  assertEquals(await (await run(deps)).json(), { accounts: 2, sent: 1, failed: 1 });
  assertEquals(state.released, [["ben", null]]);
});

Deno.test("claims again while batches come back full, and stops on a short one", async () => {
  const full = Array.from({ length: BATCH }, (_, i) => row(`reader-${i}`));
  const { state, deps } = setup([full, [row("last")]]);
  assertEquals(await (await run(deps)).json(), { accounts: BATCH + 1, sent: BATCH + 1, failed: 0 });
  assertEquals(state.claims, 2);
});

Deno.test("the email names who wrote, never what they wrote, and escapes club names", () => {
  const email = clubPostsEmail({ to: "a@example.com", name: null, rows: [row("ada", { clubName: "<Tea & Books>" })], site: SITE, unsubscribe: `${SITE}/u` });
  assertStringIncludes(email.html, "&lt;Tea &amp; Books&gt;");
  assertFalse(email.html.includes("<Tea"));
  assertStringIncludes(email.text, "Posts about chapters you haven't reached yet stay hidden");
  assertStringIncludes(email.text, `Stop them in one click: ${SITE}/u`);
});

Deno.test("names and chapter lines read naturally", () => {
  assertEquals(names([]), "A member");
  assertEquals(names(["Ada"]), "Ada");
  assertEquals(names(["Ada", "Ben"]), "Ada and Ben");
  assertEquals(names(["Ada", "Ben", "Cal"]), "Ada, Ben and Cal");
  assertEquals(names(["Ada", "Ben", "Cal", "Dee", "Eve"]), "Ada, Ben and 3 others");
  const [club] = byClub([row("ada", { chapterIndex: 5 }), row("ada", { chapterIndex: 1, posts: 1, authors: ["Ben"] })]);
  assertEquals(club.chapters.map((c) => c.chapter), [2, 6]);
  assertEquals(club.posts, 3);
  assertEquals(chapterLine(club.chapters[0]), "Chapter 2: 1 post from Ben");
});
