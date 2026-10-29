// deno test --allow-env supabase/functions/stripe-webhook — runs offline with stubbed Stripe and database.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import type { Stripe } from "../_shared/stripe.ts";
import { type Deps, handle, type SubscriptionFields } from "./handler.ts";

const USER = "00000000-0000-0000-0000-00000000000a";
const PERIOD_END = 1_798_761_600; // 2027-01-01T00:00:00Z
const ANCHOR = 1_797_552_000; // 2026-12-18T00:00:00Z: billing day 18

function subscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    pause_collection: null,
    cancel_at_period_end: false,
    billing_cycle_anchor: ANCHOR,
    items: { data: [{ price: { lookup_key: "literaryworm_standard_monthly" }, current_period_end: PERIOD_END }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function event(type: string, object: Record<string, unknown>, id = "evt_1"): Stripe.Event {
  return { id, type, livemode: false, data: { object } } as unknown as Stripe.Event;
}

function setup(ev: Stripe.Event, overrides: Partial<Deps> = {}) {
  const state = {
    handled: new Map<string, boolean>(),
    started: [] as { userId: string; fields: SubscriptionFields; consentAt: string }[],
    updated: [] as SubscriptionFields[],
    cancelled: [] as string[],
    deletedInvoices: [] as string[],
    sub: subscription(),
    admin: false,
  };
  const deps: Deps = {
    verify: (_body, signature) => (signature === "good" ? Promise.resolve(ev) : Promise.reject(new Error("bad"))),
    alreadyHandled: (id) => Promise.resolve(state.handled.has(id)),
    markHandled: (e, review) => {
      state.handled.set(e.id, review);
      return Promise.resolve();
    },
    userForCustomer: (c) => Promise.resolve(c === "cus_1" ? USER : null),
    isAdmin: () => Promise.resolve(state.admin),
    getSubscription: () => Promise.resolve(state.sub),
    startMembership: (userId, fields, consentAt) => {
      state.started.push({ userId, fields, consentAt });
      return Promise.resolve();
    },
    updateMembership: (_userId, fields) => {
      state.updated.push(fields);
      return Promise.resolve(true);
    },
    cancelNow: (id) => {
      state.cancelled.push(id);
      return Promise.resolve();
    },
    deleteDraftInvoice: (id) => {
      state.deletedInvoices.push(id);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { state, deps };
}

function post(signature: string | null = "good") {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature) headers.set("Stripe-Signature", signature);
  return new Request("http://local/stripe-webhook", { method: "POST", headers, body: "{}" });
}

const completed = (overrides: Record<string, unknown> = {}) =>
  event("checkout.session.completed", {
    id: "cs_1",
    mode: "subscription",
    subscription: "sub_1",
    payment_status: "paid",
    created: 1_797_000_000,
    ...overrides,
  });

Deno.test("refuses requests without a valid Stripe signature", async () => {
  const { state, deps } = setup(completed());
  assertEquals((await handle(post(null), deps)).status, 400);
  assertEquals((await handle(post("forged"), deps)).status, 400);
  assertEquals(state.started.length, 0);
});

Deno.test("a paid Checkout starts the membership, with the renewal consent, once", async () => {
  const { state, deps } = setup(completed());
  assertEquals((await handle(post(), deps)).status, 200);
  assertEquals(state.started.length, 1);
  const { userId, fields, consentAt } = state.started[0];
  assertEquals(userId, USER);
  assertEquals(fields.plan_id, "standard");
  assertEquals(fields.status, "active");
  assertEquals(fields.billing_day, 18);
  assertEquals(fields.current_period_end, "2027-01-01T00:00:00.000Z");
  assertEquals(consentAt, new Date(1_797_000_000 * 1000).toISOString());
  const again = await handle(post(), deps);
  assertEquals((await again.json()).duplicate, true);
  assertEquals(state.started.length, 1);
});

Deno.test("an unpaid Checkout doesn't start a membership", async () => {
  const { state, deps } = setup(completed({ payment_status: "unpaid" }));
  assertEquals((await handle(post(), deps)).status, 200);
  assertEquals(state.started.length, 0);
});

Deno.test("a failed renewal marks the membership past due", async () => {
  const { state, deps } = setup(event("invoice.payment_failed", { id: "in_1", parent: { subscription_details: { subscription: "sub_1" } } }));
  state.sub = subscription({ status: "past_due" });
  await handle(post(), deps);
  assertEquals(state.updated.map((f) => f.status), ["past_due"]);
});

Deno.test("paused collection, cancellation at period end and deletion are kept in step", async () => {
  const paused = setup(event("customer.subscription.updated", subscription({ pause_collection: { behavior: "void" } }) as unknown as Record<string, unknown>));
  await handle(post(), paused.deps);
  assertEquals(paused.state.updated[0].status, "paused");
  const ending = setup(event("customer.subscription.updated", subscription({ cancel_at_period_end: true }) as unknown as Record<string, unknown>));
  await handle(post(), ending.deps);
  assertEquals(ending.state.updated[0].cancel_at_period_end, true);
  const deleted = setup(event("customer.subscription.deleted", subscription({ status: "canceled" }) as unknown as Record<string, unknown>));
  await handle(post(), deleted.deps);
  assertEquals(deleted.state.updated[0].status, "cancelled");
});

Deno.test("admins are never billed: their subscription is cancelled and nothing is saved", async () => {
  const { state, deps } = setup(completed());
  state.admin = true;
  await handle(post(), deps);
  assertEquals(state.cancelled, ["sub_1"]);
  assertEquals(state.started.length, 0);
});

Deno.test("a renewal invoice drafted for an admin is deleted before it's charged", async () => {
  const { state, deps } = setup(
    event("invoice.created", { id: "in_9", status: "draft", customer: "cus_1", parent: { subscription_details: { subscription: "sub_1" } } }),
  );
  state.admin = true;
  await handle(post(), deps);
  assertEquals(state.cancelled, ["sub_1"]);
  assertEquals(state.deletedInvoices, ["in_9"]);
});

Deno.test("disputes, refunds and fraud warnings are kept for review", async () => {
  for (const type of ["charge.dispute.created", "charge.refunded", "radar.early_fraud_warning.created"]) {
    const { state, deps } = setup(event(type, { id: "x_1" }));
    await handle(post(), deps);
    assertEquals(state.handled.get("evt_1"), true, type);
  }
});

Deno.test("a failure isn't recorded, so Stripe retries the event", async () => {
  const { state, deps } = setup(completed(), { startMembership: () => Promise.reject(new Error("db down")) });
  assertEquals((await handle(post(), deps)).status, 500);
  assert(!state.handled.has("evt_1"));
});

Deno.test("only POST", async () => {
  const { deps } = setup(completed());
  assertEquals((await handle(new Request("http://local/stripe-webhook"), deps)).status, 405);
});
