// deno test --allow-env supabase/functions/whats-new — runs offline with a stand-in database and Mailgun.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Email, type Entry, monthName, whatsNewEmail } from "./email.ts";
import { type Deps, handle, lastMonth, type Recipient } from "./handler.ts";

const SECRET = "s3cret-value";
const SITE = "https://www.literaryworm.com";
const NOW = new Date("2026-11-01T10:00:00Z");
const ENTRIES: Entry[] = [
  { kind: "feature", title: "Who's who", body: "The characters you've met so far." },
  { kind: "update", title: "Cancel 48 hours ahead", body: "To stop the next charge." },
];

function setup(overrides: Partial<Deps> = {}) {
  const state = { sent: [] as { email: Email; unsubscribe: string }[], released: [] as string[], asked: null as null | { from: string; to: string }, claimedMonth: "" };
  const recipients: Recipient[] = [
    { userId: "user-a", email: "a@example.com", name: "Ada" },
    { userId: "user-b", email: "b@example.com", name: null },
  ];
  const deps: Deps = {
    secret: () => Promise.resolve(SECRET),
    entries: (from, to) => {
      state.asked = { from, to };
      return Promise.resolve(ENTRIES);
    },
    claim: (month) => {
      state.claimedMonth = month;
      return Promise.resolve(recipients);
    },
    release: (userId) => {
      state.released.push(userId);
      return Promise.resolve();
    },
    unsubscribeLink: (userId) => Promise.resolve(`${SITE}/unsubscribe?t=${userId}.sig`),
    send: (email, unsubscribe) => {
      state.sent.push({ email, unsubscribe });
      return Promise.resolve();
    },
    siteOrigin: SITE,
    now: () => NOW,
    ...overrides,
  };
  return { deps, state };
}

const post = (auth: string | null = `Bearer ${SECRET}`) =>
  new Request("http://local/whats-new", { method: "POST", headers: auth ? { Authorization: auth } : {}, body: "{}" });

Deno.test("refuses a call without the secret, or when Vault has none", async () => {
  const { deps, state } = setup();
  assertEquals((await handle(post(null), deps)).status, 401);
  assertEquals((await handle(post("Bearer wrong"), deps)).status, 401);
  assertEquals((await handle(post("Bearer "), setup({ secret: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals((await handle(new Request("http://local/whats-new"), deps)).status, 405);
  assertEquals(state.sent.length, 0);
});

Deno.test("covers last month, whole, even across a year", () => {
  assertEquals(lastMonth(NOW), { month: "2026-10-01", from: "2026-10-01", to: "2026-10-31" });
  assertEquals(lastMonth(new Date("2027-01-02T10:00:00Z")), { month: "2026-12-01", from: "2026-12-01", to: "2026-12-31" });
  assertEquals(lastMonth(new Date("2028-03-01T00:00:00Z")).to, "2028-02-29");
});

Deno.test("emails last month's major entries to each account that asked, once", async () => {
  const { deps, state } = setup();
  const res = await handle(post(), deps);
  assertEquals(await res.json(), { month: "2026-10-01", entries: 2, accounts: 2, sent: 2, failed: 0 });
  assertEquals(state.asked, { from: "2026-10-01", to: "2026-10-31" });
  assertEquals(state.claimedMonth, "2026-10-01");
  assertEquals(state.sent.map((s) => s.email.to), ["a@example.com", "b@example.com"]);
  assertEquals(state.sent[0].email.subject, "What's new in LiteraryWorm: October 2026");
  assertEquals(state.sent[0].unsubscribe, `${SITE}/unsubscribe?t=user-a.sig`);
});

Deno.test("sends nothing when last month had no major entries", async () => {
  let claimed = false;
  const { deps, state } = setup({
    entries: () => Promise.resolve([]),
    claim: () => {
      claimed = true;
      return Promise.resolve([]);
    },
  });
  const res = await handle(post(), deps);
  assertEquals((await res.json()).sent, 0);
  assertFalse(claimed);
  assertEquals(state.sent.length, 0);
});

Deno.test("an account Mailgun refuses is handed back for the next run", async () => {
  const { deps, state } = setup({
    send: (email) => (email.to === "b@example.com" ? Promise.reject(new Error("Mailgun answered 500")) : Promise.resolve()),
  });
  const res = await handle(post(), deps);
  assertEquals(await res.json(), { month: "2026-10-01", entries: 2, accounts: 2, sent: 1, failed: 1 });
  assertEquals(state.released, ["user-b"]);
});

Deno.test("a failure before sending is a 500 in the usual shape", async () => {
  const { deps } = setup({ entries: () => Promise.reject(new Error("db down")) });
  const res = await handle(post(), deps);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.code, "server_error");
});

Deno.test("the email lists the major changes, links to the page, and unsubscribes in one click", () => {
  const email = whatsNewEmail({ to: "a@example.com", name: "Ada", month: "2026-10-01", entries: ENTRIES, site: SITE, unsubscribe: `${SITE}/unsubscribe?t=x` });
  assertStringIncludes(email.text, "Hi Ada,");
  assertStringIncludes(email.text, "New: Who's who");
  assertStringIncludes(email.text, "Updated: Cancel 48 hours ahead");
  assertStringIncludes(email.text, `${SITE}/whats-new`);
  assertStringIncludes(email.text, `Unsubscribe in one click: ${SITE}/unsubscribe?t=x`);
  assertStringIncludes(email.html, "See everything that changed");
  assertStringIncludes(email.html, "Unsubscribe in one click");
  assertEquals(monthName("2026-12-01"), "December 2026");
});

Deno.test("the email escapes titles and names", () => {
  const email = whatsNewEmail({
    to: "a@example.com",
    name: "<b>Ada</b>",
    month: "2026-10-01",
    entries: [{ kind: "fix", title: "<script>x</script>", body: "A & B" }],
    site: SITE,
    unsubscribe: `${SITE}/unsubscribe?t=x`,
  });
  assert(!email.html.includes("<script>"));
  assert(!email.html.includes("<b>Ada</b>"));
  assertStringIncludes(email.html, "A &amp; B");
});
