// deno test --allow-env supabase/functions/club-calendar — runs offline with a stand-in database.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { checkFeedToken, feedToken } from "./feed.ts";
import { type Deps, handle } from "./handler.ts";

const KEY = "feed-signing-key";
const CLUB = "00000000-0000-0000-0000-0000000000c1";
const ANN = "00000000-0000-0000-0000-00000000000a";
const BEN = "00000000-0000-0000-0000-00000000000b";
const BASE = "https://project.supabase.co/functions/v1/club-calendar";
const SITE = "https://www.literaryworm.com";
const NOW = new Date("2026-11-01T12:00:00Z");

function setup(overrides: Partial<Deps> = {}, members = [ANN]) {
  const state = { since: null as Date | null };
  const deps: Deps = {
    requireUser: (req) =>
      req.headers.get("Authorization") === "Bearer ann" ? Promise.resolve({ id: ANN }) : Promise.reject(new HttpError("unauthorized", "Sign in first.")),
    rateLimit: () => Promise.resolve(),
    key: () => Promise.resolve(KEY),
    isMember: (clubId, userId) => Promise.resolve(clubId === CLUB && members.includes(userId)),
    club: (id) => Promise.resolve(id === CLUB ? { id, name: "Tuesday, Readers; Club", volumeId: "dracula" } : null),
    meetings: (_id, since) => {
      state.since = since;
      return Promise.resolve([
        { id: "m1", startsAt: "2026-11-10T19:00:00Z", minutes: 90, title: "Chapters 1 to 5", note: "Bring snacks" },
        { id: "m2", startsAt: "2026-11-24T19:00:00Z", minutes: 60, title: "The end", note: null },
      ]);
    },
    feedBase: BASE,
    siteOrigin: SITE,
    now: () => NOW,
    ...overrides,
  };
  return { state, deps };
}

const post = (body: unknown, who = "ann") =>
  new Request(BASE, { method: "POST", headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json", Origin: SITE }, body: JSON.stringify(body) });
const get = (token: string) => new Request(`${BASE}?t=${encodeURIComponent(token)}`);

Deno.test("a member gets a link only for their own club", async () => {
  const { deps } = setup();
  const res = await handle(post({ clubId: CLUB }), deps);
  assertEquals(res.status, 200);
  const { url } = await res.json();
  assertEquals(url, `${BASE}?t=${await feedToken(CLUB, ANN, KEY)}`);
  assertEquals((await handle(post({ clubId: "00000000-0000-0000-0000-0000000000c2" }), deps)).status, 404);
  assertEquals((await handle(post({ clubId: CLUB }, "nobody"), deps)).status, 401);
  assertEquals((await handle(post({ clubId: "x" }), deps)).status, 400);
  assertEquals((await handle(post({ clubId: CLUB, extra: 1 }), deps)).status, 400);
});

Deno.test("the feed lists the club's meetings as one calendar, from 30 days back", async () => {
  const { state, deps } = setup();
  const res = await handle(get(await feedToken(CLUB, ANN, KEY)), deps);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/calendar; charset=utf-8");
  const body = await res.text();
  assertStringIncludes(body, "BEGIN:VCALENDAR\r\n");
  assertStringIncludes(body, "X-WR-CALNAME:Tuesday\\, Readers\\; Club (LiteraryWorm)");
  assertStringIncludes(body, "UID:m1@literaryworm.com");
  assertStringIncludes(body, "DTSTART:20261110T190000Z\r\nDTEND:20261110T203000Z");
  assertStringIncludes(body, "UID:m2@literaryworm.com");
  assertStringIncludes(body, `SEQUENCE:${Math.floor(NOW.getTime() / 60_000)}`);
  assertStringIncludes(body, "Dracula");
  assertEquals(body.match(/BEGIN:VEVENT/g)?.length, 2);
  assert(body.split("\r\n").every((line) => line.length <= 75));
  assertEquals(state.since?.toISOString(), "2026-10-02T12:00:00.000Z");
});

Deno.test("a made-up, changed or someone else's token gets nothing; so does a member who left", async () => {
  const { deps } = setup({}, [ANN]);
  const good = await feedToken(CLUB, ANN, KEY);
  for (const token of ["", "nonsense", good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"), good.replace(ANN, BEN), await feedToken(CLUB, ANN, "other-key")]) {
    assertEquals((await handle(get(token), deps)).status, 404, token);
  }
  // Ben's link is real, but he isn't in the club (any more).
  assertEquals((await handle(get(await feedToken(CLUB, BEN, KEY)), deps)).status, 404);
  assertEquals(await checkFeedToken(good, KEY), { clubId: CLUB, userId: ANN });
  assertFalse(await checkFeedToken(`${good}.x`, KEY));
});

Deno.test("too many feed reads are turned away plainly", async () => {
  const { deps } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Too many requests.", 3600)) });
  assertEquals((await handle(get(await feedToken(CLUB, ANN, KEY)), deps)).status, 429);
});
