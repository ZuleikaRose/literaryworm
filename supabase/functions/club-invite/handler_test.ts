// deno test --allow-env supabase/functions/club-invite — runs offline with a stubbed database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type InviteEmail, inviteEmail, longDate } from "./email.ts";
import { type Deps, emailHash, handle, parseEmail, type RecordResult } from "./handler.ts";

const USER = "00000000-0000-0000-0000-00000000000a";
const CLUB = "11111111-1111-4111-8111-111111111111";
const SITE = "https://www.literaryworm.com";

const OK: RecordResult = {
  status: "ok",
  invite_id: "inv-1",
  club_name: "Sunday Readers",
  volume_id: "dune",
  finishes_on: "2026-12-04",
  invite_code: "SundayRead",
  inviter_name: "Ada",
};

function setup(result: RecordResult = OK, overrides: Partial<Deps> = {}) {
  const state = { sent: [] as InviteEmail[], forgotten: [] as string[], hashes: [] as string[] };
  const deps: Deps = {
    requireUser: () => Promise.resolve({ id: USER, email: "ada@example.com" }),
    rateLimit: () => Promise.resolve(),
    record: (_user, _club, hash) => {
      state.hashes.push(hash);
      return Promise.resolve(result);
    },
    forget: (id) => {
      state.forgotten.push(id);
      return Promise.resolve();
    },
    send: (email) => {
      state.sent.push(email);
      return Promise.resolve();
    },
    bookTitle: (id) => (id === "dune" ? "Dune" : null),
    siteOrigin: SITE,
    ...overrides,
  };
  return { deps, state };
}

const post = (body: unknown) =>
  new Request("http://localhost/club-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });

Deno.test("sends the invitation and keeps only a fingerprint of the address", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ clubId: CLUB, email: "  Friend@Example.com " }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: true });
  assertEquals(state.sent.length, 1);
  assertEquals(state.sent[0].to, "friend@example.com");
  assertEquals(state.hashes, [await emailHash(CLUB, "friend@example.com")]);
  assertFalse(state.hashes[0].includes("friend"));
  assertEquals(state.sent[0].subject, "Ada invited you to Sunday Readers on LiteraryWorm");
  assertStringIncludes(state.sent[0].text, `${SITE}/clubs/join/SundayRead`);
  assertStringIncludes(state.sent[0].text, "reading Dune together");
});

Deno.test("each refusal from the database has its own message, and nothing is sent", async () => {
  const cases: [RecordResult["status"], number, string][] = [
    ["not_member", 404, "clubs you're in"],
    ["full", 400, "full"],
    ["too_many", 400, "10 invitations"],
    ["already_invited", 400, "last week"],
  ];
  for (const [status, code, words] of cases) {
    const { deps, state } = setup({ status } as RecordResult);
    const res = await handle(post({ clubId: CLUB, email: "friend@example.com" }), deps);
    assertEquals(res.status, code, status);
    assertStringIncludes((await res.json()).error.message, words);
    assertEquals(state.sent.length, 0);
  }
});

Deno.test("a refused send forgets the invitation so it can be sent again", async () => {
  const { deps, state } = setup(OK, { send: () => Promise.reject(new Error("Mailgun answered 401")) });
  const res = await handle(post({ clubId: CLUB, email: "friend@example.com" }), deps);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error.code, "upstream_error");
  assertEquals(state.forgotten, ["inv-1"]);
});

Deno.test("checks the input", async () => {
  const { deps, state } = setup();
  for (const body of [
    { clubId: "nope", email: "friend@example.com" },
    { clubId: CLUB, email: "not an email" },
    { clubId: CLUB, email: "a@b" },
    { clubId: CLUB, email: `${"x".repeat(250)}@example.com` },
    { clubId: CLUB, email: "friend@example.com", message: "hi" },
    { clubId: CLUB, email: "ADA@example.com" },
  ]) {
    const res = await handle(post(body), deps);
    assertEquals(res.status, 400, JSON.stringify(body));
  }
  assertEquals(state.hashes.length, 0);
});

Deno.test("needs a signed-in member and POST", async () => {
  const { deps } = setup(OK, { requireUser: () => Promise.reject(new HttpError("unauthorized", "Log in to do that.")) });
  assertEquals((await handle(post({ clubId: CLUB, email: "friend@example.com" }), deps)).status, 401);
  const { deps: d2 } = setup();
  assertEquals((await handle(new Request("http://localhost/club-invite", { method: "GET" }), d2)).status, 405);
});

Deno.test("the email escapes names members typed and keeps the subject on one line", () => {
  const email = inviteEmail(
    { to: "f@example.com", inviterName: "<b>Ada</b>\nBcc: x", clubName: "Night & Day", bookTitle: null, finishesOn: "2026-12-04", inviteCode: "SundayRead" },
    SITE,
  );
  assertFalse(email.html.includes("<b>Ada</b>"));
  assertStringIncludes(email.html, "&lt;b&gt;Ada&lt;/b&gt;");
  assertStringIncludes(email.html, "Night &amp; Day");
  assertFalse(email.subject.includes("\n"));
  assertStringIncludes(email.text, "reading a book together");
});

Deno.test("parseEmail and longDate", () => {
  assertEquals(parseEmail(" A.B+c@Mail.Example.org "), "a.b+c@mail.example.org");
  assertEquals(longDate("2026-12-04"), "4 December 2026");
});
