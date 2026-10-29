// deno test --allow-env supabase/functions/checkout — runs offline with stubbed auth, database and Stripe.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type CheckoutInput, type Deps, handle, type Membership } from "./handler.ts";

const ORIGIN = "http://localhost:5173";
const USER = { id: "00000000-0000-0000-0000-00000000000a", email: "ann@example.com" };
const NOW = new Date("2026-10-24T12:00:00Z");

function setup(membership: Membership | null, overrides: Partial<Deps> = {}) {
  const state = { checkouts: [] as CheckoutInput[], planChanges: [] as [string, string][], customers: 0, admin: false };
  const deps: Deps = {
    requireUser: () => Promise.resolve(USER),
    rateLimit: () => Promise.resolve(),
    isAdmin: () => Promise.resolve(state.admin),
    getMembership: () => Promise.resolve(membership),
    customerFor: () => {
      state.customers++;
      return Promise.resolve("cus_1");
    },
    createCheckout: (input) => {
      state.checkouts.push(input);
      return Promise.resolve("https://checkout.stripe.com/c/pay/cs_test_1");
    },
    changePlan: (sub, plan) => {
      state.planChanges.push([sub, plan]);
      return Promise.resolve();
    },
    siteOrigin: () => ORIGIN,
    now: () => NOW,
    ...overrides,
  };
  return { state, deps };
}

async function call(deps: Deps, body: unknown) {
  const res = await handle(
    new Request("http://local/checkout", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", Authorization: "Bearer test" },
      body: JSON.stringify(body),
    }),
    deps,
  );
  return { status: res.status, body: await res.json() };
}

const choice = (overrides: Record<string, unknown> = {}) => ({ planId: "standard", billingDay: 5, renewalTermsAccepted: true, ...overrides });

Deno.test("admins are refused before anything touches Stripe", async () => {
  const { state, deps } = setup(null);
  state.admin = true;
  const res = await call(deps, choice());
  assertEquals(res.status, 400);
  assert(res.body.error.message.includes("never charged"));
  assertEquals(state.customers + state.checkouts.length, 0);
});

Deno.test("a new member gets a Stripe Checkout link, billed from their next billing day", async () => {
  const { state, deps } = setup(null);
  const res = await call(deps, choice());
  assertEquals(res.status, 200);
  assertEquals(res.body.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  const input = state.checkouts[0];
  assertEquals(input.planId, "standard");
  assertEquals(input.customerId, "cus_1");
  assertEquals(new Date(input.billingCycleAnchor! * 1000).toISOString(), "2026-11-05T00:00:00.000Z");
});

Deno.test("choosing today's date bills from today, with no partial first charge", async () => {
  const { state, deps } = setup(null);
  await call(deps, choice({ billingDay: 24 }));
  assertEquals(state.checkouts[0].billingCycleAnchor, null);
});

Deno.test("a member billed through Stripe changes plan in place, without a new Checkout", async () => {
  const { state, deps } = setup({ plan_id: "basic", status: "active", stripe_subscription_id: "sub_1" });
  const res = await call(deps, choice({ planId: "premium" }));
  assertEquals(res.body, { planId: "premium" });
  assertEquals(state.planChanges, [["sub_1", "premium"]]);
  assertEquals(state.checkouts.length, 0);
  assertEquals((await call(deps, choice({ planId: "basic" }))).status, 400);
});

Deno.test("a cancelled or unlinked membership starts a new Checkout", async () => {
  for (const m of [
    { plan_id: "basic", status: "cancelled" as const, stripe_subscription_id: "sub_old" },
    { plan_id: "basic", status: "active" as const, stripe_subscription_id: null },
  ]) {
    const { state, deps } = setup(m);
    await call(deps, choice());
    assertEquals(state.checkouts.length, 1);
  }
});

Deno.test("bad input is refused", async () => {
  const { deps } = setup(null);
  for (const body of [choice({ planId: "gold" }), choice({ billingDay: 29 }), choice({ billingDay: 0 }), choice({ renewalTermsAccepted: false }), { ...choice(), extra: 1 }]) {
    assertEquals((await call(deps, body)).status, 400, JSON.stringify(body));
  }
});

Deno.test("signed-out callers get 401 with the standard error shape", async () => {
  const { deps } = setup(null, { requireUser: () => Promise.reject(new HttpError("unauthorized", "Log in to do that.")) });
  const res = await call(deps, choice());
  assertEquals(res.status, 401);
  assertEquals(res.body.error.code, "unauthorized");
});
