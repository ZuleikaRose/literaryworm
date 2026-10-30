// deno test --allow-env supabase/functions/kids-report — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Email, finishedLine, goalLine, kidLine, type KidWeek, kidsReportEmail, timeRead, weekLabel } from "./email.ts";
import { type Deps, handle, lastWeek, type Recipient } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
// A Monday morning.
const NOW = new Date("2026-11-02T08:00:00Z");
const MIA: KidWeek = { name: "Mia", minutes: 135, listeningMinutes: 40, daysRead: 4, booksFinished: 2, finishedBooks: ["frankenstein", "zzGoogleVolume1"] };
const LEO: KidWeek = { name: "Leo", minutes: 0, listeningMinutes: 0, daysRead: 0, booksFinished: 0, finishedBooks: [] };

function setup(overrides: Partial<Deps> = {}) {
  const state = { sent: [] as { email: Email; unsubscribe: string }[], released: [] as string[], claimedWeek: "", asked: [] as string[] };
  const recipients: Recipient[] = [
    { userId: "user-a", email: "a@example.com", name: "Ada" },
    { userId: "user-b", email: "b@example.com", name: null },
  ];
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: (week) => {
      state.claimedWeek = week;
      return Promise.resolve(recipients);
    },
    week: (userId, from, to) => {
      state.asked.push(`${userId} ${from} ${to}`);
      return Promise.resolve(userId === "user-a" ? [MIA, LEO] : [LEO]);
    },
    release: (userId) => {
      state.released.push(userId);
      return Promise.resolve();
    },
    unsubscribeLink: (userId) => Promise.resolve(`${SITE}/unsubscribe?t=${userId}.sig&l=kids-report`),
    send: (email, unsubscribe) => {
      state.sent.push({ email, unsubscribe });
      return Promise.resolve();
    },
    siteOrigin: SITE,
    now: () => NOW,
    ...overrides,
  };
  return { state, deps };
}

const run = (deps: Deps, auth = `Bearer ${KEY}`) =>
  handle(new Request("http://local/kids-report", { method: "POST", headers: { Authorization: auth } }), deps);

Deno.test("last week runs Monday to Sunday, whichever day the run is", () => {
  assertEquals(lastWeek(new Date("2026-11-02T08:00:00Z")), { week: "2026-10-26", from: "2026-10-26", to: "2026-11-01" });
  assertEquals(lastWeek(new Date("2026-11-03T08:00:00Z")), { week: "2026-10-26", from: "2026-10-26", to: "2026-11-01" });
  assertEquals(lastWeek(new Date("2026-11-08T23:00:00Z")), { week: "2026-10-26", from: "2026-10-26", to: "2026-11-01" });
});

Deno.test("only the cron job's key is accepted", async () => {
  const { state, deps } = setup();
  assertEquals((await run(deps, "Bearer wrong")).status, 401);
  assertEquals((await run(deps, "")).status, 401);
  assertEquals((await run(setup({ secret: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals(state.sent.length, 0);
});

Deno.test("each claimed account gets last week's report for its Kids profiles", async () => {
  const { state, deps } = setup();
  const res = await run(deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { week: "2026-10-26", accounts: 2, sent: 2, failed: 0 });
  assertEquals(state.claimedWeek, "2026-10-26");
  assertEquals(state.asked, ["user-a 2026-10-26 2026-11-01", "user-b 2026-10-26 2026-11-01"]);
  const [ada] = state.sent;
  assertEquals(ada.email.to, "a@example.com");
  assertStringIncludes(ada.email.subject, "26 October to 1 November 2026");
  assertStringIncludes(ada.email.text, "Hi Ada,");
  assertStringIncludes(ada.email.text, "Mia\n2 h 15 min on 4 days (40 min of it listening).\nFinished 2 books: Frankenstein and 1 more.");
  assertStringIncludes(ada.email.text, "Leo\nNo reading or listening this week.");
  assertStringIncludes(ada.email.html, "l=kids-report");
});

Deno.test("an account whose email fails is handed back; one with no Kids profiles left is skipped", async () => {
  const failing = setup({ send: (email) => (email.to === "a@example.com" ? Promise.reject(new Error("refused")) : Promise.resolve()) });
  assertEquals(await (await run(failing.deps)).json(), { week: "2026-10-26", accounts: 2, sent: 1, failed: 1 });
  assertEquals(failing.state.released, ["user-a"]);

  const empty = setup({ week: () => Promise.resolve([]) });
  assertEquals(await (await run(empty.deps)).json(), { week: "2026-10-26", accounts: 2, sent: 0, failed: 0 });
  assertEquals(empty.state.released, []);
});

Deno.test("the email's words", () => {
  assertEquals(timeRead(0), "No reading");
  assertEquals(timeRead(45), "45 min");
  assertEquals(timeRead(120), "2 h");
  assertEquals(weekLabel("2026-12-28", "2027-01-03"), "28 December to 3 January 2027");
  assertEquals(kidLine({ ...MIA, listeningMinutes: 0, daysRead: 1 }), "2 h 15 min on 1 day.");
  assertEquals(finishedLine(LEO), null);
  assertEquals(finishedLine({ ...MIA, finishedBooks: ["zzGoogleVolume1"], booksFinished: 1 }), "Finished 1 book.");
  const email = kidsReportEmail({ to: "x@example.com", name: null, weekFrom: "2026-10-26", weekTo: "2026-11-01", kids: [{ ...MIA, name: "<Mia>" }], site: SITE, unsubscribe: `${SITE}/u` });
  assertStringIncludes(email.html, "&lt;Mia&gt;");
  assertFalse(email.html.includes("<Mia>"));
  assertStringIncludes(email.text, "Hi,");
});

Deno.test("the weekly goal a grown-up set says whether the week reached it", () => {
  assertEquals(goalLine({ ...MIA, goalMinutes: null }), null);
  assertEquals(goalLine({ ...MIA, minutes: 150, goalMinutes: 120 }), "Weekly goal: 2 h. Reached!");
  assertEquals(goalLine({ ...MIA, minutes: 45, goalMinutes: 120 }), "Weekly goal: 2 h. 1 h 15 min short.");
});
