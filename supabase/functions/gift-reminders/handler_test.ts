// deno test --allow-env supabase/functions/gift-reminders — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Email, giftDay, giftStartEmail } from "./email.ts";
import { type Deps, handle, type Reminder } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
const CODE = "ABCDEFGHJKLMNPQR";

const reminder = (email: string, name: string | null = "Ada"): Reminder => ({
  gift: { id: `gift-${email}`, planId: "standard", months: 3, startsOn: "2027-03-14" },
  email,
  name,
});

function setup(reminders: Reminder[], overrides: Partial<Deps> = {}) {
  const state = { sent: [] as Email[], released: [] as string[] };
  const deps: Deps = {
    secret: () => Promise.resolve(KEY),
    claim: () => Promise.resolve(reminders),
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

const run = (deps: Deps, key = KEY) =>
  handle(new Request("http://local/gift-reminders", { method: "POST", headers: { Authorization: `Bearer ${key}` } }), deps);

Deno.test("only the cron job's secret is let in", async () => {
  const { state, deps } = setup([reminder("ada@example.com")]);
  assertEquals((await run(deps, "wrong")).status, 401);
  assertEquals((await handle(new Request("http://local/gift-reminders", { method: "POST" }), deps)).status, 401);
  assertEquals((await handle(new Request("http://local/gift-reminders"), deps)).status, 405);
  const missing = setup([reminder("ada@example.com")], { secret: () => Promise.resolve(null) });
  assertEquals((await run(missing.deps)).status, 401);
  assertEquals(state.sent.length + missing.state.sent.length, 0);
});

Deno.test("each buyer hears once, with the day and a link to their gifts, never the code", async () => {
  const { state, deps } = setup([reminder("ada@example.com"), reminder("ben@example.com", null)]);
  assertEquals(await (await run(deps)).json(), { gifts: 2, sent: 2, failed: 0 });
  const [ada, ben] = state.sent;
  assertEquals(ada.subject, "Your LiteraryWorm gift starts on Sunday 14 March 2027");
  assertStringIncludes(ada.text, "Hi Ada,");
  assertStringIncludes(ada.text, "3 months of Standard, can be redeemed from Sunday 14 March 2027");
  assertStringIncludes(ada.text, `${SITE}/gifts`);
  assertStringIncludes(ada.html, `href="${SITE}/gifts"`);
  assertStringIncludes(ben.text, "Hi,");
  assertFalse(ada.text.includes(CODE) || ada.html.includes(CODE));
});

Deno.test("a gift whose email fails is handed back for the next run", async () => {
  const { state, deps } = setup([reminder("ada@example.com"), reminder("bounce@example.com")], {
    send: (e) => (e.to.startsWith("bounce") ? Promise.reject(new Error("refused")) : Promise.resolve()),
  });
  assertEquals(await (await run(deps)).json(), { gifts: 2, sent: 1, failed: 1 });
  assertEquals(state.released, ["gift-bounce@example.com"]);
});

Deno.test("the day is the date as written, in any time zone; a year's gift says so", () => {
  assertEquals(giftDay("2027-01-01"), "Friday 1 January 2027");
  const email = giftStartEmail({ to: "x@example.com", name: "<b>", gift: { id: "g", planId: "premium", months: 12, startsOn: "2027-01-01" }, site: SITE });
  assertStringIncludes(email.text, "a year of Premium");
  assertStringIncludes(email.html, "Hi &lt;b&gt;,");
});
