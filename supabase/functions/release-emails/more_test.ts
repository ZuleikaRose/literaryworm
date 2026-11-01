// deno test --allow-env supabase/functions/release-emails — devices and the push service are stubbed.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import type { PushMessage } from "../_shared/webpush.ts";
import { meetingPush, postsPush, pushMore, streakPush } from "./more.ts";

const HOUR = 3_600_000;

Deno.test("a meeting: the club and meeting, and how many hours away (no clock time)", () => {
  const m = meetingPush({ userId: "u", clubId: "c1", clubName: "Tuesday Readers", title: "Volume one", startsAt: new Date(10 * HOUR).toISOString() }, 5 * HOUR);
  assertEquals(m.title, "Tuesday Readers: Volume one");
  assertEquals(m.body, "The club meets in about 5 hours. Tap to see the meeting.");
  assertEquals(m.url, "/clubs/c1");
});

Deno.test("club posts: how many, up to which chapter and who, never what they said", () => {
  const p = postsPush({ userId: "u", clubId: "c1", clubName: "Tuesday Readers", lastChapter: 2, posts: 3, authors: ["Ana", "Bo", "Cy"] });
  assertEquals(p.title, "New in Tuesday Readers");
  assertEquals(p.body, "3 new posts up to chapter 3, from Ana, Bo and others.");
  assertEquals(postsPush({ userId: "u", clubId: "c1", clubName: "C", lastChapter: 0, posts: 1, authors: ["Ana"] }).body, "1 new post up to chapter 1, from Ana.");
});

Deno.test("the streak nudge names the profile and the run", () => {
  const s = streakPush({ userId: "u", profileName: "Ada", days: 4 });
  assertEquals(s.title, "4 days in a row");
  assertStringIncludes(s.body, "Ada hasn't read yet today");
});

Deno.test("each kind is claimed, and an account's messages all go to each of its devices", async () => {
  const sent: [string, PushMessage][] = [];
  const result = await pushMore({
    now: () => 0,
    meetings: () => Promise.resolve([{ userId: "a", clubId: "c", clubName: "Club", title: "Meet", startsAt: new Date(3 * HOUR).toISOString() }]),
    posts: () => Promise.resolve([{ userId: "a", clubId: "c", clubName: "Club", lastChapter: 1, posts: 2, authors: ["Bo"] }]),
    streaks: () => Promise.resolve([{ userId: "b", profileName: "Ada", days: 3 }]),
    devices: () =>
      Promise.resolve([
        { id: "d1", userId: "a", endpoint: "https://p/1", p256dh: "k", auth: "x" },
        { id: "d2", userId: "b", endpoint: "https://p/2", p256dh: "k", auth: "x" },
      ]),
    send: (d, m) => {
      sent.push([d.id, m]);
      return Promise.resolve("sent");
    },
    forget: () => Promise.resolve(),
    touch: () => Promise.resolve(),
  });
  assertEquals(result, { accounts: 2, sent: 2, gone: 0, failed: 0 });
  assertEquals(sent.map(([id, m]) => `${id}:${m.title}`), ["d1:Club: Meet", "d1:New in Club", "d2:3 days in a row"]);
});

Deno.test("a device that has unsubscribed gets nothing more in the run", async () => {
  let sends = 0;
  let forgot: string[] = [];
  await pushMore({
    meetings: () => Promise.resolve([{ userId: "a", clubId: "c", clubName: "Club", title: "Meet", startsAt: new Date(Date.now() + 3 * HOUR).toISOString() }]),
    posts: () => Promise.resolve([{ userId: "a", clubId: "c", clubName: "Club", lastChapter: 1, posts: 2, authors: ["Bo"] }]),
    streaks: () => Promise.resolve([]),
    devices: () => Promise.resolve([{ id: "d1", userId: "a", endpoint: "https://p/1", p256dh: "k", auth: "x" }]),
    send: () => {
      sends += 1;
      return Promise.resolve("gone");
    },
    forget: (ids) => Promise.resolve(void (forgot = ids)),
    touch: () => Promise.resolve(),
  });
  assertEquals(sends, 1);
  assertEquals(forgot, ["d1"]);
});
