// deno test --allow-env supabase/functions/gift-reminders — runs offline with a stand-in database and Mailgun.
import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { type Delivery, type Email, giftDay, giftStartEmail } from "./email.ts";
import { type Deps, handle, type Reminder } from "./handler.ts";

const KEY = "cron-key-value";
const SITE = "https://www.literaryworm.com";
const CODE = "ABCDEFGHJKLMNPQR";

const reminder = (email: string, name: string | null = "Ada"): Reminder => ({
  gift: { id: `gift-${email}`, planId: "standard", months: 3, startsOn: "2027-03-14" },
  email,
  name,
});

const delivery = (to: string, overrides: Partial<Delivery> = {}): Delivery => ({
  gift: { id: `gift-${to}`, code: CODE, planId: "premium", months: 12, startsOn: null },
  to,
  message: null,
  from: "Ann",
  ...overrides,
});

function setup(reminders: Reminder[], overrides: Partial<Deps> = {}, deliveries: Delivery[] = []) {
  const state = { sent: [] as Email[], released: [] as string[], unsent: [] as string[], cleared: [] as string[] };
  const deps: Deps = {
    claimDeliveries: () => Promise.resolve(deliveries),
    releaseDelivery: (id) => {
      state.unsent.push(id);
      return Promise.resolve();
    },
    delivered: (id) => {
      state.cleared.push(id);
      return Promise.resolve();
    },
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
  assertEquals(await (await run(deps)).json(), { gifts: 2, sent: 2, failed: 0, deliveries: 0, delivered: 0, undelivered: 0 });
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
  assertEquals(await (await run(deps)).json(), { gifts: 2, sent: 1, failed: 1, deliveries: 0, delivered: 0, undelivered: 0 });
  assertEquals(state.released, ["gift-bounce@example.com"]);
});

Deno.test("the day is the date as written, in any time zone; a year's gift says so", () => {
  assertEquals(giftDay("2027-01-01"), "Friday 1 January 2027");
  const email = giftStartEmail({ to: "x@example.com", name: "<b>", gift: { id: "g", planId: "premium", months: 12, startsOn: "2027-01-01" }, site: SITE });
  assertStringIncludes(email.text, "a year of Premium");
  assertStringIncludes(email.html, "Hi &lt;b&gt;,");
});

Deno.test("an emailed gift reaches its recipient with the code, the message and a link that fills it in", async () => {
  const { state, deps } = setup([], {}, [delivery("sam@example.com", { message: "Happy birthday!\n<3 Ann" }), delivery("kit@example.com", { from: null })]);
  assertEquals(await (await run(deps)).json(), { gifts: 0, sent: 0, failed: 0, deliveries: 2, delivered: 2, undelivered: 0 });
  const [sam, kit] = state.sent;
  assertEquals(sam.to, "sam@example.com");
  assertEquals(sam.subject, "A LiteraryWorm gift from Ann");
  assertStringIncludes(sam.text, "Ann sent you a year of Premium");
  assertStringIncludes(sam.text, "Ann wrote:\nHappy birthday!\n<3 Ann");
  assertStringIncludes(sam.text, "Your code: ABCD-EFGH-JKLM-NPQR");
  assertStringIncludes(sam.html, `href="${SITE}/gifts?code=${CODE}"`);
  assertStringIncludes(sam.html, "&lt;3 Ann");
  assertEquals(kit.subject, "You've been sent a LiteraryWorm gift");
  assertStringIncludes(kit.text, "Someone sent you");
  // Once sent, the address and message are forgotten.
  assertEquals(state.cleared, ["gift-sam@example.com", "gift-kit@example.com"]);
});

Deno.test("a gift that can't be emailed is handed back and keeps its recipient", async () => {
  const { state, deps } = setup([], { send: () => Promise.reject(new Error("refused")) }, [delivery("sam@example.com")]);
  assertEquals(await (await run(deps)).json(), { gifts: 0, sent: 0, failed: 0, deliveries: 1, delivered: 0, undelivered: 1 });
  assertEquals(state.unsent, ["gift-sam@example.com"]);
  assertEquals(state.cleared, []);
});
