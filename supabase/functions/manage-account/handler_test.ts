// deno test --allow-env supabase/functions/manage-account — runs offline with stubbed auth and database.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import type { DiscountView, InvoiceView } from "../_shared/stripe.ts";
import { type Deps, type Gift, handle, nextBillingDate, type Subscription } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const USER = { id: "00000000-0000-0000-0000-00000000000a", email: "ann@example.com" };
const NOW = new Date("2026-10-24T12:00:00Z");
const INVOICE: InvoiceView = {
  date: "2026-10-05T00:00:00.000Z",
  amount: 1039,
  currency: "usd",
  status: "paid",
  discount: 260,
  url: "https://invoice.stripe.com/i/test_1",
};
const GIFT_CODE = "ABCDEFGHJKLMNPQR";
const SPRING: DiscountView = { code: "SPRING20", percentOff: 20, amountOff: null, currency: null, duration: "repeating", ends: "2027-01-05T00:00:00.000Z" };

function setup(sub: Subscription | null, overrides: Partial<Deps> = {}) {
  const state = {
    sub,
    deleted: false,
    emails: [] as { to: string; subject: string; text: string }[],
    passwordChecks: 0,
    stripe: [] as string[],
    gift: { id: "gift_1", plan_id: "standard", months: 3, redeemed_at: null } as Gift,
    redeemedBy: null as string | null,
  };
  const record = (call: string) => {
    state.stripe.push(call);
    return Promise.resolve();
  };
  const deps: Deps = {
    requireUser: () => Promise.resolve(USER),
    confirmPassword: (_email, password) => {
      state.passwordChecks++;
      return password === "right password" ? Promise.resolve() : Promise.reject(new HttpError("forbidden", "That password isn't right."));
    },
    rateLimit: () => Promise.resolve(),
    getSubscription: () => Promise.resolve(state.sub),
    updateSubscription: (_id, patch) => {
      state.sub = { ...state.sub!, ...patch };
      return Promise.resolve(state.sub);
    },
    deleteUser: () => {
      state.deleted = true;
      return Promise.resolve();
    },
    sendEmail: (email) => {
      state.emails.push(email);
      return Promise.resolve();
    },
    billing: {
      pause: (id) => record(`pause ${id}`),
      resume: (id) => record(`resume ${id}`),
      setCancelAtPeriodEnd: (id, cancel) => record(`cancel_at_period_end ${id} ${cancel}`),
      cancelAt: (id, at) => record(`cancel_at ${id} ${new Date(at * 1000).toISOString()}`),
      clearCancelAt: (id) => record(`clear cancel_at ${id}`),
      cancelNow: (id) => record(`cancel ${id}`),
      moveRenewal: (id, until) => record(`renew ${id} ${new Date(until * 1000).toISOString().slice(0, 10)}`),
      paymentMethodUrl: (customer, returnUrl) => {
        state.stripe.push(`portal ${customer} ${returnUrl}`);
        return Promise.resolve("https://billing.stripe.com/p/session/test_1");
      },
      invoices: (customer) => {
        state.stripe.push(`invoices ${customer}`);
        return Promise.resolve([INVOICE]);
      },
      discount: (id) => {
        state.stripe.push(`discount ${id}`);
        return Promise.resolve(null);
      },
      redeem: (id, code) => {
        state.stripe.push(`redeem ${id} ${code}`);
        return Promise.resolve(code.toUpperCase() === "SPRING20" ? SPRING : null);
      },
      extendForGift: (id, until) => record(`gift ${id} ${new Date(until * 1000).toISOString().slice(0, 10)}`),
      startGift: ({ giftId, customerId, planId, until }) =>
        record(`start gift ${giftId} ${customerId} ${planId} ${new Date(until * 1000).toISOString().slice(0, 10)}`),
    },
    gifts: {
      find: (code) => Promise.resolve(code === GIFT_CODE ? state.gift : null),
      claim: (_id, userId) => {
        if (state.gift.redeemed_at) return Promise.resolve(false);
        state.gift = { ...state.gift, redeemed_at: NOW.toISOString() };
        state.redeemedBy = userId;
        return Promise.resolve(true);
      },
      release: () => {
        state.gift = { ...state.gift, redeemed_at: null };
        state.redeemedBy = null;
        return Promise.resolve();
      },
    },
    customerFor: () => Promise.resolve("cus_9"),
    siteOrigin: () => ORIGIN,
    now: () => NOW,
    ...overrides,
  };
  return { state, deps };
}

const active = (): Subscription => ({
  plan_id: "standard",
  status: "active",
  billing_interval: "month",
  billing_day: 5,
  cancel_at_period_end: false,
  current_period_end: null,
  cancel_at: null,
  complimentary: false,
  gift_until: null,
  stripe_subscription_id: null,
  stripe_customer_id: null,
});

/** A membership paid through Stripe, paid up to 5 Nov 2026. */
const paid = (): Subscription => ({
  ...active(),
  current_period_end: "2026-11-05T00:00:00.000Z",
  stripe_subscription_id: "sub_1",
  stripe_customer_id: "cus_1",
});

const complimentary = (): Subscription => ({
  plan_id: "premium",
  status: "active",
  billing_interval: "month",
  billing_day: null,
  cancel_at_period_end: false,
  current_period_end: null,
  cancel_at: null,
  complimentary: true,
  gift_until: null,
  stripe_subscription_id: null,
  stripe_customer_id: null,
});

function post(body: unknown, origin = ORIGIN) {
  return new Request("http://local/manage-account", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Authorization: "Bearer test" },
    body: JSON.stringify(body),
  });
}

async function call(deps: Deps, body: unknown) {
  const res = await handle(post(body), deps);
  return { status: res.status, body: await res.json(), res };
}

Deno.test("next billing date is this month's billing day if it's still ahead, otherwise next month's", () => {
  assertEquals(nextBillingDate(28, NOW).toISOString().slice(0, 10), "2026-10-28");
  assertEquals(nextBillingDate(5, NOW).toISOString().slice(0, 10), "2026-11-05");
  assertEquals(nextBillingDate(5, new Date("2026-12-20T00:00:00Z")).toISOString().slice(0, 10), "2027-01-05");
});

Deno.test("pause, then resume", async () => {
  const { state, deps } = setup(active());
  assertEquals((await call(deps, { action: "pause" })).body.status, "paused");
  assertEquals(state.sub!.status, "paused");
  assertEquals((await call(deps, { action: "resume" })).body.status, "active");
});

Deno.test("cancel keeps reading until the next billing date, and restart undoes it", async () => {
  const { state, deps } = setup(active());
  const cancelled = await call(deps, { action: "cancel" });
  assertEquals(cancelled.status, 200);
  assertEquals(state.sub!.cancel_at_period_end, true);
  assertEquals(state.sub!.current_period_end!.slice(0, 10), "2026-11-05");
  assertEquals(state.sub!.status, "active");
  const paused = await call(deps, { action: "pause" });
  assertEquals(paused.status, 400);
  await call(deps, { action: "restart" });
  assertEquals(state.sub!.cancel_at_period_end, false);
  assertEquals(state.sub!.current_period_end, null);
  assertEquals(state.sub!.cancel_at, null);
});

// 36 hours before the 5 November billing date.
const LATE = new Date("2026-11-03T12:00:00Z");

Deno.test("cancelling with under 48 hours' notice keeps the next charge and ends a month later, in Stripe too", async () => {
  const { state, deps } = setup(paid(), { now: () => LATE });
  const res = await call(deps, { action: "cancel" });
  assertEquals(res.status, 200);
  assertEquals(state.stripe, ["cancel_at sub_1 2026-12-05T00:00:00.000Z"]);
  assertEquals(state.sub!.cancel_at, "2026-12-05T00:00:00.000Z");
  assertEquals(state.sub!.current_period_end, "2026-11-05T00:00:00.000Z");
  assertEquals(res.body.cancel_at, "2026-12-05T00:00:00.000Z");
  await call(deps, { action: "restart" });
  assertEquals(state.stripe.at(-1), "clear cancel_at sub_1");
  assertEquals([state.sub!.cancel_at_period_end, state.sub!.cancel_at], [false, null]);
});

Deno.test("with 48 hours' notice or more the membership ends on the billing date, with nothing more charged", async () => {
  const { state, deps } = setup(paid());
  await call(deps, { action: "cancel" });
  assertEquals(state.stripe, ["cancel_at_period_end sub_1 true"]);
  assertEquals(state.sub!.cancel_at, "2026-11-05T00:00:00.000Z");
});

Deno.test("the 48-hour rule applies to memberships without Stripe too", async () => {
  const { state, deps } = setup(active(), { now: () => LATE });
  await call(deps, { action: "cancel" });
  assertEquals(state.sub!.current_period_end, "2026-11-05T00:00:00.000Z");
  assertEquals(state.sub!.cancel_at, "2026-12-05T00:00:00.000Z");
});

Deno.test("a paused membership isn't charged, so cancelling it late still ends it on the billing date", async () => {
  const { state, deps } = setup({ ...paid(), status: "paused" }, { now: () => LATE });
  await call(deps, { action: "cancel" });
  assertEquals(state.stripe, ["cancel_at_period_end sub_1 true"]);
  assertEquals(state.sub!.cancel_at, "2026-11-05T00:00:00.000Z");
});

Deno.test("cancelling twice changes nothing the second time", async () => {
  const { state, deps } = setup(paid(), { now: () => LATE });
  await call(deps, { action: "cancel" });
  await call(deps, { action: "cancel" });
  assertEquals(state.stripe.length, 1);
  assertEquals(state.sub!.cancel_at, "2026-12-05T00:00:00.000Z");
});

Deno.test("no plan yet is a plain 404", async () => {
  const { deps } = setup(null);
  const res = await call(deps, { action: "pause" });
  assertEquals(res.status, 404);
  assertEquals(res.body.error.code, "not_found");
});

Deno.test("delete needs confirm and the right password, cancels the plan, then deletes the user", async () => {
  const { state, deps } = setup(active());
  assertEquals((await call(deps, { action: "delete", password: "right password" })).status, 400);
  const wrong = await call(deps, { action: "delete", password: "nope", confirm: true });
  assertEquals(wrong.status, 403);
  assertEquals(state.deleted, false);
  assertEquals(state.sub!.status, "active");
  const ok = await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(ok.status, 200);
  assertEquals(ok.body, { deleted: true });
  assertEquals(state.sub!.status, "cancelled");
  assert(state.deleted);
});

Deno.test("deleting emails the address once it's done, saying the plan was cancelled", async () => {
  const { state, deps } = setup(active());
  await call(deps, { action: "delete", password: "nope", confirm: true });
  assertEquals(state.emails.length, 0);
  await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(state.emails.length, 1);
  assertEquals(state.emails[0].to, USER.email);
  assertEquals(state.emails[0].subject, "Your LiteraryWorm account has been deleted");
  assert(state.emails[0].text.includes("nothing more will be charged"));
});

Deno.test("an admin's deletion email doesn't mention a cancelled plan", async () => {
  const { state, deps } = setup(complimentary());
  await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(state.emails.length, 1);
  assert(!state.emails[0].text.includes("nothing more will be charged"));
});

Deno.test("an email that fails to send doesn't undo or fail the deletion", async () => {
  const { state, deps } = setup(active(), { sendEmail: () => Promise.reject(new Error("Mailgun answered 500")) });
  const res = await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(res.status, 200);
  assertEquals(res.body, { deleted: true });
  assert(state.deleted);
});

Deno.test("an account with no plan yet still gets the email, without mention of charges", async () => {
  const { state, deps } = setup(null);
  await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(state.emails.length, 1);
  assert(!state.emails[0].text.includes("nothing more will be charged"));
});

Deno.test("an admin's complimentary membership can't be paused, resumed, cancelled or restarted", async () => {
  const { state, deps } = setup(complimentary());
  for (const action of ["pause", "resume", "cancel", "restart"]) {
    const res = await call(deps, { action });
    assertEquals(res.status, 400, action);
    assert(res.body.error.message.includes("never charged"), action);
  }
  assertEquals(state.sub, complimentary());
});

Deno.test("deleting an admin account leaves the complimentary membership alone, then deletes the user", async () => {
  const updates: unknown[] = [];
  const { state, deps } = setup(complimentary(), {
    updateSubscription: (_id, patch) => {
      updates.push(patch);
      return Promise.resolve(complimentary());
    },
  });
  const res = await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(res.status, 200);
  assertEquals(updates, []);
  assert(state.deleted);
});

Deno.test("delete works for an account that never chose a plan", async () => {
  const { state, deps } = setup(null);
  const res = await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(res.status, 200);
  assert(state.deleted);
});

Deno.test("unknown actions and extra fields are refused", async () => {
  const { deps } = setup(active());
  assertEquals((await call(deps, { action: "upgrade" })).status, 400);
  const extra = await call(deps, { action: "pause", status: "active" });
  assertEquals(extra.status, 400);
  assertEquals(extra.body.error.message, "Unexpected field: status.");
});

Deno.test("signed-out callers get 401 with the standard error shape", async () => {
  const { deps } = setup(active(), { requireUser: () => Promise.reject(new HttpError("unauthorized", "Log in to do that.")) });
  const res = await call(deps, { action: "pause" });
  assertEquals(res.status, 401);
  assertEquals(res.body, { error: { code: "unauthorized", message: "Log in to do that." } });
});

Deno.test("only POST, with CORS for allowed origins only", async () => {
  const { deps } = setup(active());
  const get = await handle(new Request("http://local/manage-account", { headers: { Origin: ORIGIN } }), deps);
  assertEquals(get.status, 405);
  assertEquals(get.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const other = await handle(post({ action: "pause" }, "https://evil.example"), deps);
  assertEquals(other.headers.get("Access-Control-Allow-Origin"), null);
  const pre = await handle(new Request("http://local/manage-account", { method: "OPTIONS", headers: { Origin: ORIGIN } }), deps);
  assertEquals(pre.status, 204);
});

Deno.test("unexpected database errors don't leak details", async () => {
  const { deps } = setup(active(), { getSubscription: () => Promise.reject(new Error("connection reset by peer at 10.0.0.3")) });
  const res = await call(deps, { action: "pause" });
  assertEquals(res.status, 500);
  assertEquals(res.body.error.message, "Something went wrong. Try again.");
});

Deno.test("a Stripe membership is paused, resumed, cancelled and restarted in Stripe too", async () => {
  const { state, deps } = setup(paid());
  await call(deps, { action: "pause" });
  await call(deps, { action: "resume" });
  const cancel = await call(deps, { action: "cancel" });
  assertEquals(cancel.body.current_period_end, "2026-11-05T00:00:00.000Z");
  await call(deps, { action: "restart" });
  assertEquals(state.stripe, ["pause sub_1", "resume sub_1", "cancel_at_period_end sub_1 true", "cancel_at_period_end sub_1 false"]);
  assertEquals(state.sub!.current_period_end, "2026-11-05T00:00:00.000Z");
});

Deno.test("moving the billing day gives free days up to the new date, never a second charge", async () => {
  const later = setup(paid());
  const res = await call(later.deps, { action: "billing_day", billingDay: 20 });
  assertEquals(res.status, 200);
  assertEquals(later.state.stripe, ["renew sub_1 2026-11-20"]);
  assertEquals(later.state.sub!.billing_day, 20);
  const earlier = setup(paid());
  await call(earlier.deps, { action: "billing_day", billingDay: 2 });
  assertEquals(earlier.state.stripe, ["renew sub_1 2026-12-02"]);
});

Deno.test("the billing day can't move to the same day, out of range, or while ending or paused", async () => {
  const { deps } = setup(paid());
  for (const day of [5, 0, 29]) assertEquals((await call(deps, { action: "billing_day", billingDay: day })).status, 400, String(day));
  const ending = setup({ ...paid(), cancel_at_period_end: true });
  assertEquals((await call(ending.deps, { action: "billing_day", billingDay: 9 })).status, 400);
  const paused = setup({ ...paid(), status: "paused" });
  assertEquals((await call(paused.deps, { action: "billing_day", billingDay: 9 })).status, 400);
});

Deno.test("updating the payment method opens Stripe's page for this member's customer", async () => {
  const { state, deps } = setup(paid());
  const res = await call(deps, { action: "payment_method" });
  assertEquals(res.body.url, "https://billing.stripe.com/p/session/test_1");
  assertEquals(state.stripe, [`portal cus_1 ${ORIGIN}/account#plan`]);
  const unlinked = setup(active());
  assertEquals((await call(unlinked.deps, { action: "payment_method" })).status, 400);
  const admin = setup(complimentary());
  assertEquals((await call(admin.deps, { action: "payment_method" })).status, 400);
});

Deno.test("deleting the account cancels the Stripe subscription first", async () => {
  const { state, deps } = setup(paid());
  const res = await call(deps, { action: "delete", password: "right password", confirm: true });
  assertEquals(res.status, 200);
  assertEquals(state.stripe, ["cancel sub_1"]);
  assert(state.deleted);
});

Deno.test("responses never include Stripe's ids, only whether the membership is linked", async () => {
  const { deps } = setup(paid());
  const res = await call(deps, { action: "pause" });
  assertEquals(res.body.stripe_linked, true);
  assertEquals("stripe_subscription_id" in res.body || "stripe_customer_id" in res.body, false);
});

Deno.test("billing history lists the customer's charges and the promo code on the membership", async () => {
  const { state, deps } = setup(paid());
  const res = await call(deps, { action: "billing_history" });
  assertEquals(res.status, 200);
  assertEquals(res.body, { invoices: [INVOICE], discount: null });
  assertEquals(state.stripe, ["invoices cus_1", "discount sub_1"]);
  assertEquals((await call(deps, { action: "billing_history", extra: 1 })).status, 400);
});

Deno.test("billing history is empty with no Stripe customer or a complimentary membership, and still lists an ended one", async () => {
  for (const sub of [active(), complimentary()]) {
    const { state, deps } = setup(sub);
    assertEquals((await call(deps, { action: "billing_history" })).body, { invoices: [], discount: null });
    assertEquals(state.stripe, []);
  }
  const ended = setup({ ...paid(), status: "cancelled" });
  assertEquals((await call(ended.deps, { action: "billing_history" })).body.invoices, [INVOICE]);
  assertEquals(ended.state.stripe, ["invoices cus_1"]);
  assertEquals((await call(setup(null).deps, { action: "billing_history" })).status, 404);
});

Deno.test("a promo code is applied to the Stripe subscription", async () => {
  const { state, deps } = setup(paid());
  const res = await call(deps, { action: "promo_code", code: "  spring20 " });
  assertEquals(res.status, 200);
  assertEquals(res.body, { discount: SPRING });
  assertEquals(state.stripe, ["redeem sub_1 spring20"]);
});

Deno.test("unknown codes, bad input and memberships without Stripe are refused", async () => {
  const { state, deps } = setup(paid());
  const unknown = await call(deps, { action: "promo_code", code: "NOPE99" });
  assertEquals(unknown.status, 400);
  assertEquals(unknown.body.error.code, "bad_request");
  for (const code of [undefined, 42, "ab", "x".repeat(41), "SPRING 20", "<script>"]) {
    assertEquals((await call(deps, { action: "promo_code", code })).status, 400);
  }
  assertEquals((await call(deps, { action: "promo_code", code: "SPRING20", extra: true })).status, 400);
  assertEquals(state.stripe, ["redeem sub_1 NOPE99"]);
  for (const sub of [active(), complimentary(), { ...paid(), status: "cancelled" as const }]) {
    const other = setup(sub);
    assertEquals((await call(other.deps, { action: "promo_code", code: "SPRING20" })).status, 400);
    assertEquals(other.state.stripe, []);
  }
});

Deno.test("cancelling never sends Stripe's ids either", async () => {
  const { deps } = setup(paid());
  const res = await call(deps, { action: "cancel" });
  assertEquals(res.body.stripe_linked, true);
  assertEquals("stripe_subscription_id" in res.body || "stripe_customer_id" in res.body, false);
});

// --- Gifts --------------------------------------------------------------------------

Deno.test("a gift on the same plan moves the next charge back by its months", async () => {
  const { state, deps } = setup(paid());
  const res = await call(deps, { action: "gift", code: "abcd-efgh-jklm-npqr" });
  assertEquals(res.status, 200);
  // Paid to 5 Nov; three months free after that.
  assertEquals(state.stripe, ["gift sub_1 2027-02-05"]);
  assertEquals(res.body.gift, { planId: "standard", months: 3, until: "2027-02-05T00:00:00.000Z" });
  assertEquals(res.body.subscription.gift_until, "2027-02-05T00:00:00.000Z");
  assertEquals(res.body.subscription.stripe_subscription_id, undefined);
  assertEquals(state.redeemedBy, USER.id);
});

Deno.test("without a membership, a gift starts one free for its months, with the member's agreement", async () => {
  const refused = setup(null);
  assertEquals((await call(refused.deps, { action: "gift", code: GIFT_CODE })).status, 400);
  assertEquals(refused.state.redeemedBy, null);

  const { state, deps } = setup(null);
  const res = await call(deps, { action: "gift", code: GIFT_CODE, renewalTermsAccepted: true });
  assertEquals(res.status, 200);
  // 24 Oct + 3 months is 24 Jan: a billing day, so it stays.
  assertEquals(state.stripe, ["start gift gift_1 cus_9 standard 2027-01-24"]);
  assertEquals(res.body.subscription, undefined);
});

Deno.test("a gift for another plan, a paused membership or an admin is refused and the code stays unused", async () => {
  for (const [sub, words] of [
    [{ ...paid(), plan_id: "premium" }, "This gift is for Standard and your membership is Premium"],
    [{ ...paid(), status: "paused" as const }, "Resume your membership first"],
    [{ ...active(), complimentary: true, billing_day: null }, "complimentary"],
  ] as const) {
    const { state, deps } = setup(sub as Subscription);
    const res = await call(deps, { action: "gift", code: GIFT_CODE, renewalTermsAccepted: true });
    assertEquals(res.status, 400);
    assert(res.body.error.message.includes(words), res.body.error.message);
    assertEquals(state.stripe, []);
    assertEquals(state.gift.redeemed_at, null);
  }
});

Deno.test("a gift code works once; unknown and badly typed codes are refused", async () => {
  const { state, deps } = setup(paid());
  assertEquals((await call(deps, { action: "gift", code: GIFT_CODE })).status, 200);
  const again = await call(deps, { action: "gift", code: GIFT_CODE });
  assertEquals(again.status, 400);
  assert(again.body.error.message.includes("already been used"));
  assertEquals((await call(deps, { action: "gift", code: "ZZZZZZZZZZZZZZZZ" })).status, 400);
  const typo = await call(deps, { action: "gift", code: "O0I1" });
  assert(typo.body.error.message.includes("16 letters and numbers"));
  assertEquals(state.stripe.length, 1);
});

Deno.test("when Stripe fails, the gift is released so the code still works", async () => {
  const { state, deps } = setup(paid());
  deps.billing.extendForGift = () => Promise.reject(new Error("stripe down"));
  assertEquals((await call(deps, { action: "gift", code: GIFT_CODE })).status, 500);
  assertEquals(state.gift.redeemed_at, null);
});

Deno.test("the billing day can't move while a gift's free months last", async () => {
  const { deps } = setup({ ...paid(), gift_until: "2027-02-05T00:00:00.000Z" });
  const res = await call(deps, { action: "billing_day", billingDay: 12 });
  assertEquals(res.status, 400);
  assert(res.body.error.message.includes("once the gift"));
});

Deno.test("once Stripe has the gift's months, a later failure doesn't free the code for a second use", async () => {
  const { state, deps } = setup(paid());
  deps.updateSubscription = () => Promise.reject(new Error("db down"));
  assertEquals((await call(deps, { action: "gift", code: GIFT_CODE })).status, 500);
  assertEquals(state.stripe, ["gift sub_1 2027-02-05"]);
  assert(state.gift.redeemed_at !== null);
});

Deno.test("a yearly membership can't be paused or move its billing day, and a late cancel ends a year on", async () => {
  const yearly = (): Subscription => ({ ...paid(), billing_interval: "year" });
  for (const body of [{ action: "pause" }, { action: "billing_day", billingDay: 9 }]) {
    const { deps } = setup(yearly());
    const res = await call(deps, body);
    assertEquals(res.status, 400, JSON.stringify(body));
    assert(res.body.error.message.includes("yearly"));
  }
  const { state, deps } = setup(yearly(), { now: () => new Date("2026-11-04T12:00:00Z") });
  const res = await call(deps, { action: "cancel" });
  assertEquals(res.status, 200);
  assertEquals(res.body.cancel_at, "2027-11-05T00:00:00.000Z");
  assertEquals(state.stripe.at(-1), "cancel_at sub_1 2027-11-05T00:00:00.000Z");
});
