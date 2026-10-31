// deno test --allow-env supabase/functions/unsubscribe — runs offline with a stand-in database.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { checkUnsubscribeToken, unsubscribeToken } from "../_shared/unsubscribe.ts";
import { type Deps, handle } from "./handler.ts";

const KEY = "test-signing-key";
const USER = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";

function setup(overrides: Partial<Deps> = {}) {
  const off: string[] = [];
  const lists: string[] = [];
  const deps: Deps = {
    key: () => Promise.resolve(KEY),
    turnOff: (id, list) => {
      off.push(id);
      lists.push(list);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { deps, off, lists };
}

Deno.test("a link names which email it turns off: What's new unless it says the Kids report", async () => {
  const token = await unsubscribeToken(USER, KEY);
  const plain = setup();
  assertEquals((await handle(oneClick(token), plain.deps)).status, 200);
  assertEquals(plain.lists, ["whats-new"]);

  const kids = setup();
  const req = new Request(`http://local/unsubscribe?t=${encodeURIComponent(token)}&l=kids-report`, { method: "POST", body: "List-Unsubscribe=One-Click" });
  assertEquals((await handle(req, kids.deps)).status, 200);
  assertEquals(kids.lists, ["kids-report"]);

  const site = setup();
  assertEquals((await handle(fromSite({ token, list: "kids-report" }), site.deps)).status, 200);
  assertEquals(site.lists, ["kids-report"]);

  const posts = setup();
  assertEquals((await handle(fromSite({ token, list: "club-posts" }), posts.deps)).status, 200);
  assertEquals(posts.lists, ["club-posts"]);

  const bad = setup();
  assertEquals((await handle(fromSite({ token, list: "marketing" }), bad.deps)).status, 400);
  assertEquals(bad.off, []);
});

const oneClick = (token: string) =>
  new Request(`http://local/unsubscribe?t=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });

const fromSite = (body: unknown) =>
  new Request("http://local/unsubscribe", {
    method: "POST",
    headers: { Origin: "http://localhost:5173", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("a signed token names its own account, and only that one", async () => {
  const token = await unsubscribeToken(USER, KEY);
  assertEquals(await checkUnsubscribeToken(token, KEY), USER);
  // The same signature on another account, a wrong key, or a changed signature fail.
  assertEquals(await checkUnsubscribeToken(`${OTHER}.${token.split(".")[1]}`, KEY), null);
  assertEquals(await checkUnsubscribeToken(token, "another-key"), null);
  assertEquals(await checkUnsubscribeToken(`${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`, KEY), null);
});

Deno.test("malformed tokens are refused without checking a signature", async () => {
  for (const bad of [null, 42, "", "nope", `${USER}.`, `${USER}.xyz`, `not-a-uuid.${"a".repeat(64)}`, `${USER}.${"a".repeat(64)}.extra`, "x".repeat(200)]) {
    assertEquals(await checkUnsubscribeToken(bad, KEY), null, String(bad));
  }
});

Deno.test("one click from the mail app turns the email off", async () => {
  const { deps, off } = setup();
  const res = await handle(oneClick(await unsubscribeToken(USER, KEY)), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { unsubscribed: true });
  assertEquals(off, [USER]);
});

Deno.test("the site's page sends the token as JSON", async () => {
  const { deps, off } = setup();
  const res = await handle(fromSite({ token: await unsubscribeToken(USER, KEY) }), deps);
  assertEquals(res.status, 200);
  assertEquals(off, [USER]);
});

Deno.test("a forged or missing token changes nothing", async () => {
  const { deps, off } = setup();
  assertEquals((await handle(oneClick(`${USER}.${"0".repeat(64)}`), deps)).status, 400);
  assertEquals((await handle(fromSite({ token: "nope" }), deps)).status, 400);
  assertEquals((await handle(fromSite({}), deps)).status, 400);
  assertEquals((await handle(fromSite({ token: "x", extra: 1 }), deps)).status, 400);
  assertEquals(off, []);
});

Deno.test("only POST, and the rate limit applies before anything else", async () => {
  const { deps, off } = setup({ rateLimit: () => Promise.reject(new HttpError("rate_limited", "Slow down.", 60)) });
  assertEquals((await handle(oneClick(await unsubscribeToken(USER, KEY)), deps)).status, 429);
  assertEquals((await handle(new Request("http://local/unsubscribe", { method: "GET" }), setup().deps)).status, 405);
  assertEquals(off, []);
});
