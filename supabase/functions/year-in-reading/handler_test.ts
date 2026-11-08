// deno test --allow-env supabase/functions/year-in-reading — runs offline with a stand-in database and Mailgun.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { booksLine, type Email, monthLine, type ProfileYear, timeLine, TITLES_SHOWN, yearEmail } from "./email.ts";
import { type Deps, handle, lastYear, type Recipient } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
const NOW = new Date("2027-01-01T10:00:00Z");
const AVERY: ProfileYear = {
  name: "Avery",
  minutes: 3725,
  listeningMinutes: 600,
  daysRead: 148,
  booksFinished: 3,
  finishedBooks: ["frankenstein", "pride-and-prejudice", "zzGoogleVolume1"],
  bestMonth: 3,
};
const SAM: ProfileYear = { name: "Sam", minutes: 0, listeningMinutes: 0, daysRead: 0, booksFinished: 0, finishedBooks: [], bestMonth: null };

function setup(overrides: Partial<Deps> = {}) {
  const state = { sent: [] as { email: Email; unsubscribe: string }[], released: [] as string[], claimedYear: 0 };
  const recipients: Recipient[] = [
    { userId: "user-a", email: "a@example.com", name: "Ada" },
    { userId: "user-b", email: "b@example.com", name: null },
  ];
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: (year) => {
      state.claimedYear = year;
      return Promise.resolve(recipients);
    },
    year: (userId) => Promise.resolve(userId === "user-a" ? [AVERY, SAM] : [SAM]),
    release: (userId) => {
      state.released.push(userId);
      return Promise.resolve();
    },
    unsubscribeLink: (userId) => Promise.resolve(`${SITE}/unsubscribe?t=${userId}.sig&l=year-in-reading`),
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
  handle(new Request("http://local/year-in-reading", { method: "POST", headers: { Authorization: auth } }), deps);

Deno.test("the year is the one just ended", () => {
  assertEquals(lastYear(new Date("2027-01-01T10:00:00Z")), 2026);
  assertEquals(lastYear(new Date("2027-01-03T10:00:00Z")), 2026);
});

Deno.test("only the cron job's key is accepted", async () => {
  const { state, deps } = setup();
  assertEquals((await run(deps, "Bearer wrong")).status, 401);
  assertEquals((await run(deps, "")).status, 401);
  assertEquals((await run(setup({ secret: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals((await handle(new Request("http://local/year-in-reading"), deps)).status, 405);
  assertEquals(state.sent.length, 0);
});

Deno.test("each claimed account with reading gets its year, profiles without any left out", async () => {
  const { state, deps } = setup();
  const res = await run(deps);
  assertEquals(await res.json(), { year: 2026, accounts: 2, sent: 1, failed: 0 });
  assertEquals(state.claimedYear, 2026);
  const [ada] = state.sent;
  assertEquals(ada.email.to, "a@example.com");
  assertEquals(ada.email.subject, "Your 2026 in reading");
  assertStringIncludes(ada.email.text, "Hi Ada,");
  assertStringIncludes(ada.email.text, "In 2026 you finished 3 books.");
  assertStringIncludes(ada.email.text, "62 h 5 min on 148 days (10 h of it listening).");
  assertStringIncludes(ada.email.text, "Read most in March.");
  assertFalse(ada.email.text.includes("Sam"));
  assertStringIncludes(ada.email.html, "year-in-reading");
  assertEquals(state.released, []);
});

Deno.test("a failed send is handed back for the next run", async () => {
  const { state, deps } = setup({ send: () => Promise.reject(new Error("Mailgun down")) });
  assertEquals(await (await run(deps)).json(), { year: 2026, accounts: 2, sent: 0, failed: 1 });
  assertEquals(state.released, ["user-a"]);
});

Deno.test("lines name catalog titles, count the rest and skip what's missing", () => {
  assertEquals(timeLine(SAM), "No reading or listening this year.");
  assertEquals(booksLine(SAM), null);
  assertEquals(monthLine(SAM), null);
  const line = booksLine(AVERY)!;
  assert(line.startsWith("Finished 3 books: "));
  assert(line.endsWith(" and 1 more."));
  const many = { ...AVERY, booksFinished: 40, finishedBooks: ["frankenstein", "pride-and-prejudice", "alice-in-wonderland", "dracula", "emma", "persuasion", "middlemarch"] };
  assert(booksLine(many)!.split(", ").length <= TITLES_SHOWN);
  assertStringIncludes(booksLine({ ...AVERY, finishedBooks: ["zz1"], booksFinished: 1 })!, "Finished 1 book.");
});

Deno.test("the email escapes names and has a one-click unsubscribe", () => {
  const email = yearEmail({ to: "x@example.com", name: "<b>", year: 2026, profiles: [{ ...AVERY, name: "A&B" }], site: SITE, unsubscribe: `${SITE}/u` });
  assertStringIncludes(email.html, "Hi &lt;b&gt;,");
  assertStringIncludes(email.html, "A&amp;B");
  assertStringIncludes(email.html, `${SITE}/u`);
  assertStringIncludes(email.text, `${SITE}/library?view=stats`);
});
