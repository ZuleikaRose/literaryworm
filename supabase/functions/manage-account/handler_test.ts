// deno test --allow-env supabase/functions/manage-account — runs offline with stubbed auth and database.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type Deps, handle, nextBillingDate, type Subscription } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const USER = { id: "00000000-0000-0000-0000-00000000000a", email: "ann@example.com" };
const NOW = new Date("2026-10-24T12:00:00Z");

function setup(sub: Subscription | null, overrides: Partial<Deps> = {}) {
  const state = { sub, deleted: false, passwordChecks: 0, stripe: [] as string[] };
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
    billing: {
      pause: (id) => record(`pause ${id}`),
      resume: (id) => record(`resume ${id}`),
      setCancelAtPeriodEnd: (id, cancel) => record(`cancel_at_period_end ${id} ${cancel}`),
      cancelNow: (id) => record(`cancel ${id}`),
      moveRenewal: (id, until) => record(`renew ${id} ${new Date(until * 1000).toISOString().slice(0, 10)}`),
      paymentMethodUrl: (customer, returnUrl) => {
        state.stripe.push(`portal ${customer} ${returnUrl}`);
        return Promise.resolve("https://billing.stripe.com/p/session/test_1");
      },
    },
    siteOrigin: () => ORIGIN,
    now: () => NOW,
    ...overrides,
  };
  return { state, deps };
}

const active = (): Subscription => ({
  plan_id: "standard",
  status: "active",
  billing_day: 5,
  cancel_at_period_end: false,
  current_period_end: null,
  complimentary: false,
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
  billing_day: null,
  cancel_at_period_end: false,
  current_period_end: null,
  complimentary: true,
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
