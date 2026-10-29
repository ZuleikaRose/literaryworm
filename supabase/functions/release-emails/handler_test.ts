// deno test --allow-env supabase/functions/release-emails — runs offline with a stubbed database and Mailgun.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type DueReminder, type Email, releaseEmail } from "./email.ts";
import { type Deps, handle, sameSecret } from "./handler.ts";

const SECRET = "s3cret-value";
const SITE = "https://www.literaryworm.com";

function reminder(overrides: Partial<DueReminder> = {}): DueReminder {
  return {
    userId: "user-a",
    email: "reader@example.com",
    accountName: "Ada",
    profileId: "profile-1",
    profileName: "Ada",
    volumeId: "vol1",
    title: "The Long Way Home",
    author: "J. Writer",
    releaseDate: "2026-10-29",
    ...overrides,
  };
}

function setup(due: DueReminder[], overrides: Partial<Deps> = {}) {
  const state = { sent: [] as Email[], released: [] as DueReminder[], claimedWith: 0 };
  const deps: Deps = {
    secret: () => Promise.resolve(SECRET),
    claim: (max) => {
      state.claimedWith = max;
      return Promise.resolve(due);
    },
    release: (r) => {
      state.released.push(...r);
      return Promise.resolve();
    },
    send: (email) => {
      state.sent.push(email);
      return Promise.resolve();
    },
    siteOrigin: SITE,
    ...overrides,
  };
  return { deps, state };
}

const post = (auth?: string) =>
  new Request("http://localhost/release-emails", { method: "POST", headers: auth ? { Authorization: auth } : {} });

Deno.test("refuses a call without the secret", async () => {
  const { deps, state } = setup([reminder()]);
  assertEquals((await handle(post(), deps)).status, 401);
  assertEquals((await handle(post("Bearer wrong"), deps)).status, 401);
  assertEquals(state.claimedWith, 0);
});

Deno.test("refuses everything when the Vault secret is missing", async () => {
  const { deps, state } = setup([reminder()], { secret: () => Promise.resolve(null) });
  assertEquals((await handle(post("Bearer "), deps)).status, 401);
  assertEquals(state.sent.length, 0);
});

Deno.test("only POST", async () => {
  const { deps } = setup([]);
  const res = await handle(new Request("http://localhost/release-emails", { method: "GET" }), deps);
  assertEquals(res.status, 405);
});

Deno.test("sends one email per account, listing all its books", async () => {
  const { deps, state } = setup([
    reminder(),
    reminder({ volumeId: "vol2", title: "Second Book", profileId: "profile-2", profileName: "Sam" }),
    reminder({ userId: "user-b", email: "other@example.com", accountName: null, volumeId: "vol3", title: "Solo" }),
  ]);
  const res = await handle(post(`Bearer ${SECRET}`), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { accounts: 2, sent: 2, failed: 0 });
  assertEquals(state.sent.length, 2);
  const [a, b] = state.sent;
  assertEquals(a.to, "reader@example.com");
  assertEquals(a.subject, "2 books you were waiting for are out now");
  assertStringIncludes(a.text, "(for Sam)");
  assertEquals(b.subject, "Solo is out now");
  assertStringIncludes(b.text, "Hi,");
});

Deno.test("hands back an account's reminders when Mailgun refuses, and carries on", async () => {
  const { deps, state } = setup(
    [reminder(), reminder({ userId: "user-b", email: "other@example.com", volumeId: "vol3" })],
    {
      send(email) {
        if (email.to === "reader@example.com") return Promise.reject(new Error("Mailgun answered 400"));
        state.sent.push(email);
        return Promise.resolve();
      },
    },
  );
  const res = await handle(post(`Bearer ${SECRET}`), deps);
  assertEquals(await res.json(), { accounts: 2, sent: 1, failed: 1 });
  assertEquals(state.released.map((r) => r.userId), ["user-a"]);
  assertEquals(state.sent.map((e) => e.to), ["other@example.com"]);
});

Deno.test("a failed hand-back doesn't stop the run", async () => {
  const { deps } = setup([reminder()], {
    send: () => Promise.reject(new Error("down")),
    release: () => Promise.reject(new Error("db down")),
  });
  const res = await handle(post(`Bearer ${SECRET}`), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { accounts: 1, sent: 0, failed: 1 });
});

Deno.test("nothing due: nothing sent", async () => {
  const { deps, state } = setup([]);
  const res = await handle(post(`Bearer ${SECRET}`), deps);
  assertEquals(await res.json(), { accounts: 0, sent: 0, failed: 0 });
  assertEquals(state.sent.length, 0);
});

Deno.test("a database error is a 500 without details", async () => {
  const { deps } = setup([], { claim: () => Promise.reject(new Error("connection refused")) });
  const res = await handle(post(`Bearer ${SECRET}`), deps);
  assertEquals(res.status, 500);
  assertFalse(JSON.stringify(await res.json()).includes("connection"));
});

Deno.test("the email escapes titles and links to the book and the setting", () => {
  const email = releaseEmail([reminder({ title: `<script>alert("x")</script>`, author: "A & B" })], SITE);
  assertFalse(email.html.includes("<script>"));
  assertStringIncludes(email.html, "&lt;script&gt;");
  assertStringIncludes(email.html, "A &amp; B");
  assertStringIncludes(email.html, `${SITE}/books/vol1`);
  assertStringIncludes(email.html, `${SITE}/account#preferences`);
  assertStringIncludes(email.text, `${SITE}/account#preferences`);
  // One profile: no "(for …)".
  assertFalse(email.text.includes("(for "));
});

Deno.test("long titles are shortened in the subject, on one line", () => {
  const email = releaseEmail([reminder({ title: `${"Word ".repeat(30)}\nEnd` })], SITE);
  assert(email.subject.length <= 80 + " is out now".length);
  assertFalse(email.subject.includes("\n"));
});

Deno.test("sameSecret", () => {
  assert(sameSecret("abc", "abc"));
  assertFalse(sameSecret("abc", "abd"));
  assertFalse(sameSecret("abc", "abcd"));
  assertFalse(sameSecret("", "a"));
});
