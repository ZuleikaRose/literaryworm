// deno test --allow-env supabase/functions/club-meetings — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Email, type Meeting, meetingChangeEmail, meetingLength, meetingReminderEmail, meetingTime } from "./email.ts";
import { type ChangeNotice, type Deps, handle, type Reminder } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
const MEETING: Meeting = {
  id: "meeting-1",
  clubId: "club-1",
  clubName: "Sunday Classics",
  bookId: "pride-and-prejudice",
  title: "Chapters 1 to 10",
  note: "Bring tea.",
  startsAt: "2026-11-08T19:00:00.000Z",
  minutes: 90,
  timeZone: "Europe/London",
};

function setup(reminders: Reminder[], overrides: Partial<Deps> = {}, changes: ChangeNotice[] = []) {
  const state = { sent: [] as { email: Email; unsubscribe: string }[], released: [] as string[], releasedChanges: [] as string[] };
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: () => Promise.resolve(reminders),
    release: (id) => {
      state.released.push(id);
      return Promise.resolve();
    },
    claimChanges: () => Promise.resolve(changes),
    releaseChange: (id) => {
      state.releasedChanges.push(id);
      return Promise.resolve();
    },
    unsubscribeLink: (userId) => Promise.resolve(`${SITE}/unsubscribe?t=${userId}.sig&l=club-meetings`),
    send: (email, unsubscribe) => {
      state.sent.push({ email, unsubscribe });
      return Promise.resolve();
    },
    siteOrigin: SITE,
    ...overrides,
  };
  return { state, deps };
}

const member = (userId: string, meeting = MEETING): Reminder => ({ meeting, userId, email: `${userId}@example.com`, name: userId === "ada" ? "Ada" : null });
const run = (deps: Deps, auth = `Bearer ${KEY}`) =>
  handle(new Request("http://local/club-meetings", { method: "POST", headers: { Authorization: auth } }), deps);

Deno.test("only the cron job's key is accepted", async () => {
  const { state, deps } = setup([member("ada")]);
  assertEquals((await run(deps, "Bearer wrong")).status, 401);
  assertEquals((await run(setup([], { secret: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals(state.sent.length, 0);
});

Deno.test("every member of each claimed meeting gets one reminder", async () => {
  const other = { ...MEETING, id: "meeting-2", title: "The ending" };
  const { state, deps } = setup([member("ada"), member("ben"), member("ada", other)]);
  assertEquals(await (await run(deps)).json(), { meetings: 2, sent: 3, failed: 0, changes: { meetings: 0, sent: 0, failed: 0 } });
  assertEquals(state.sent.map((s) => s.email.to), ["ada@example.com", "ben@example.com", "ada@example.com"]);
  const [first] = state.sent;
  assertEquals(first.email.subject, "Sunday Classics meets Sunday 8 November at 19:00 GMT");
  assertStringIncludes(first.email.text, "Hi Ada,");
  assertStringIncludes(first.email.text, "talk about Pride and Prejudice");
  assertStringIncludes(first.email.text, "Sunday 8 November at 19:00 GMT, for 90 minutes");
  assertStringIncludes(first.email.html, "l=club-meetings");
  assertEquals(state.released, []);
});

Deno.test("a meeting nobody could be emailed about is handed back; one that reached someone isn't", async () => {
  const allFail = setup([member("ada"), member("ben")], { send: () => Promise.reject(new Error("refused")) });
  assertEquals(await (await run(allFail.deps)).json(), { meetings: 1, sent: 0, failed: 2, changes: { meetings: 0, sent: 0, failed: 0 } });
  assertEquals(allFail.state.released, ["meeting-1"]);

  const someFail = setup([member("ada"), member("ben")], { send: (e) => (e.to.startsWith("ben") ? Promise.reject(new Error("refused")) : Promise.resolve()) });
  assertEquals(await (await run(someFail.deps)).json(), { meetings: 1, sent: 1, failed: 1, changes: { meetings: 0, sent: 0, failed: 0 } });
  assertEquals(someFail.state.released, []);
});

Deno.test("times read in the meeting's own time zone, and text is escaped", () => {
  assertEquals(meetingTime("2026-07-05T18:30:00.000Z", "America/New_York"), "Sunday 5 July at 14:30 EDT");
  assertEquals(meetingTime("2026-07-05T18:30:00.000Z", "Not/AZone"), "Sunday 5 July at 18:30 UTC");
  assertEquals(meetingLength(60), "1 hour");
  assertEquals(meetingLength(45), "45 minutes");
  const email = meetingReminderEmail({ to: "x@example.com", name: null, meeting: { ...MEETING, title: "<b>Hi</b>" }, site: SITE, unsubscribe: `${SITE}/u` });
  assertStringIncludes(email.html, "&lt;b&gt;Hi&lt;/b&gt;");
  assertFalse(email.html.includes("<b>Hi</b>"));
});

const notice = (userId: string, kind: "moved" | "cancelled", send = true): ChangeNotice => ({
  change: { kind, meeting: kind === "moved" ? { ...MEETING, startsAt: "2026-11-15T19:00:00.000Z" } : MEETING, wasStartsAt: MEETING.startsAt },
  userId,
  email: send ? `${userId}@example.com` : `${userId}@bounce.example.com`,
  name: userId === "ada" ? "Ada" : null,
});

Deno.test("members hear when a meeting moves, with the old and new times", async () => {
  const { state, deps } = setup([], {}, [notice("ada", "moved"), notice("ben", "moved")]);
  assertEquals(await (await run(deps)).json(), { meetings: 0, sent: 0, failed: 0, changes: { meetings: 1, sent: 2, failed: 0 } });
  const [first] = state.sent;
  assertEquals(first.email.subject, "Sunday Classics: meeting moved to Sunday 15 November at 19:00 GMT");
  assertStringIncludes(first.email.text, "Hi Ada,");
  assertStringIncludes(first.email.text, "Now Sunday 15 November at 19:00 GMT, for 90 minutes");
  assertStringIncludes(first.email.text, "Was Sunday 8 November at 19:00 GMT");
  assertStringIncludes(first.email.html, "l=club-meetings");
});

Deno.test("members hear when a meeting is cancelled; a change nobody got is handed back", async () => {
  const email = meetingChangeEmail({ to: "x@example.com", name: null, change: notice("x", "cancelled").change, site: SITE, unsubscribe: `${SITE}/u` });
  assertEquals(email.subject, "Sunday Classics: meeting on Sunday 8 November at 19:00 GMT cancelled");
  assertStringIncludes(email.text, "won't go ahead");
  assertFalse(email.text.includes("Now "));

  const failing = setup([], { send: (e) => (e.to.includes("bounce") ? Promise.reject(new Error("refused")) : Promise.resolve()) }, [notice("ben", "cancelled", false)]);
  assertEquals((await (await run(failing.deps)).json()).changes, { meetings: 1, sent: 0, failed: 1 });
  assertEquals(failing.state.releasedChanges, ["meeting-1"]);
});
