// deno test --allow-env supabase/functions/sign-in-alerts — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Alert, deviceLabel, type Email, loginTime, signInAlertEmail } from "./email.ts";
import { type Deps, handle } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const alert = (email: string, overrides: Partial<Alert> = {}): Alert => ({
  sessionId: `session-${email}`,
  email,
  name: "Ada",
  device: CHROME_WINDOWS,
  signedInAt: "2026-11-27T14:05:09Z",
  ...overrides,
});

function setup(alerts: Alert[], overrides: Partial<Deps> = {}) {
  const state = { sent: [] as Email[], released: [] as string[] };
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: () => Promise.resolve(alerts),
    release: (id) => {
      state.released.push(id);
      return Promise.resolve();
    },
    send: (email) => {
      state.sent.push(email);
      return Promise.resolve();
    },
    siteOrigin: SITE,
    ...overrides,
  };
  return { state, deps };
}

const post = (key: string | null = KEY) =>
  new Request("https://x/functions/v1/sign-in-alerts", { method: "POST", headers: key ? { Authorization: `Bearer ${key}` } : {} });

Deno.test("refuses a caller without the Vault key, sending nothing", async () => {
  const { state, deps } = setup([alert("ann@example.com")]);
  assertEquals((await handle(post(null), deps)).status, 401);
  assertEquals((await handle(post("wrong"), deps)).status, 401);
  assertEquals((await handle(new Request("https://x", { method: "GET" }), deps)).status, 405);
  assertEquals(state.sent.length, 0);
});

Deno.test("emails each claimed log-in once, and hands back one that fails", async () => {
  const { state, deps } = setup([alert("ann@example.com"), alert("bo@example.com", { device: SAFARI_IPHONE })], {
    send: (email) => (email.to === "bo@example.com" ? Promise.reject(new Error("mailgun down")) : (state.sent.push(email), Promise.resolve())),
  });
  const res = await handle(post(), deps);
  assertEquals(await res.json(), { sent: 1, failed: 1 });
  assertEquals(state.sent.map((e) => e.to), ["ann@example.com"]);
  assertEquals(state.released, ["session-bo@example.com"]);
});

Deno.test("names the browser and device the way the app's device list does", () => {
  assertEquals(deviceLabel(CHROME_WINDOWS), "Chrome on Windows");
  assertEquals(deviceLabel(SAFARI_IPHONE), "Safari on iPhone");
  assertEquals(deviceLabel("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"), "Firefox on Linux");
  assertEquals(deviceLabel(""), "An unknown browser or app");
});

Deno.test("says when, in UTC, and what to do if it wasn't them", () => {
  assertEquals(loginTime("2026-11-27T14:05:09Z"), "Friday 27 November 2026 at 14:05 UTC");
  const email = signInAlertEmail({ alert: alert("ann@example.com", { name: "Ada <b>" }), site: SITE });
  assertEquals(email.subject, "New log-in to your LiteraryWorm account");
  assertStringIncludes(email.text, "Chrome on Windows");
  assertStringIncludes(email.text, "Friday 27 November 2026 at 14:05 UTC");
  assertStringIncludes(email.text, "Log out on every other device");
  assertStringIncludes(email.html, `${SITE}/account#sign-in`);
  // The display name is escaped in the HTML.
  assertStringIncludes(email.html, "Hi Ada &lt;b&gt;,");
});
