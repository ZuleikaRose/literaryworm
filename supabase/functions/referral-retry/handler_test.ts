// deno test --allow-env supabase/functions/referral-retry
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import type { Stripe } from "../_shared/stripe.ts";
import { type Deps as WebhookDeps, type ReferralTransaction, SetAside } from "../stripe-webhook/handler.ts";
import { type Deps, handle } from "./handler.ts";

const REFERRAL = "11111111-1111-4111-8111-111111111111";
const FRIEND = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const EVENT = "evt_1Abc";
const CUSTOMER = "cus_f";

const owedCredit: ReferralTransaction = {
  referralId: REFERRAL, side: "friend", kind: "credit", round: 0, customer: CUSTOMER, cents: 600, currency: "usd", rule: "percent_20", createdAt: null,
};
// An invoice.paid whose referral is decided and owes nothing more: the replay runs the webhook's handler.
const storedPaid = { id: EVENT, type: "invoice.paid", livemode: false, data: { object: { id: "in_1", customer: CUSTOMER, amount_paid: 3000, parent: { subscription_details: { subscription: "sub_1" } } } } } as unknown as Stripe.Event;

function setup(over: Partial<Deps> = {}, stripe: { fail?: Error } = {}) {
  const state = {
    owed: [owedCredit] as ReferralTransaction[],
    made: [] as string[],
    started: [] as string[],
    dismissed: [] as string[],
    replays: [] as [string, boolean, string | null][],
    claims: 0,
    decided: true,
  };
  const webhook = {
    referralOwed: () => Promise.resolve([...state.owed]),
    claimReferral: () => {
      state.claims += 1;
      return Promise.resolve([...state.owed]);
    },
    findBalanceTransaction: () => Promise.resolve(null),
    adjustBalance: (_c: string, _a: number, _cur: string, key: string) => {
      if (stripe.fail) return Promise.reject(stripe.fail);
      state.made.push(key);
      return Promise.resolve("cbtxn_1");
    },
    recordReferralTransaction: () => {
      state.owed = [];
      return Promise.resolve();
    },
    recordReferralCheck: () => Promise.resolve(),
    noteReferralFailure: () => Promise.resolve(false),
    userForCustomer: () => Promise.resolve(FRIEND),
    isStaff: () => Promise.resolve(false),
    recordCardPayment: () => Promise.resolve(),
    claimAffiliate: () => Promise.resolve(null),
    getSubscription: () =>
      Promise.resolve({
        id: "sub_1",
        customer: CUSTOMER,
        status: "active",
        pause_collection: null,
        cancel_at_period_end: false,
        billing_cycle_anchor: 1_797_552_000,
        items: { data: [{ price: { lookup_key: "literaryworm_basic_monthly" }, current_period_end: 1_798_761_600 }] },
      } as unknown as Stripe.Subscription),
    updateMembership: () => Promise.resolve(true),
  } as unknown as WebhookDeps;
  const deps: Deps = {
    requireUser: () => Promise.resolve({ id: STAFF }),
    isBilling: () => Promise.resolve(true),
    start: (id) => {
      state.started.push(id);
      return Promise.resolve(id === REFERRAL ? { referredId: FRIEND, decided: state.decided } : null);
    },
    storedEvent: (id) => Promise.resolve(id === EVENT ? storedPaid : null),
    recordReplay: (id, ok, reason) => {
      state.replays.push([id, ok, reason]);
      return Promise.resolve();
    },
    dismiss: (id) => {
      state.dismissed.push(id);
      return Promise.resolve(true);
    },
    webhook: () => webhook,
    ...over,
  };
  return { deps, state };
}

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify(body) });

Deno.test("Retry now clears the held sides and makes what's still owed, once", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ action: "retry", referralId: REFERRAL }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { decided: true, owed: 0, held: false, reason: null });
  assertEquals([state.started, state.made], [[REFERRAL], [`referral20-${REFERRAL}-friend`]]);
});

Deno.test("an undecided referral makes nothing and says so (never 'nothing more is owed')", async () => {
  const { deps, state } = setup();
  state.decided = false;
  const res = await handle(post({ action: "retry", referralId: REFERRAL }), deps);
  assertEquals([res.status, await res.json(), state.made], [200, { decided: false }, []]);
});

Deno.test("Replay runs the webhook's handler on the stored event and resolves it when nothing is set aside again", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ action: "replay", eventId: EVENT }), deps);
  assertEquals([res.status, await res.json()], [200, { done: true, reason: null }]);
  // The decision ran (asked again after the credit was recorded), and the friend's credit was made once.
  assertEquals([state.claims > 0, state.made], [true, [`referral20-${REFERRAL}-friend`]]);
  assertEquals(state.replays, [[EVENT, true, null]]);
});

Deno.test("a replay refused again keeps the event open with the new reason", async () => {
  const { deps, state } = setup({}, { fail: new SetAside("Stripe refused the key: no rights") });
  const res = await handle(post({ action: "replay", eventId: EVENT }), deps);
  const body = await res.json();
  assertEquals([res.status, body.done, state.replays[0][1]], [200, false, false]);
  assertEquals(state.replays[0][2]?.startsWith("Stripe refused the key"), true);
});

Deno.test("a replay Stripe doesn't answer: an error, the event stays open", async () => {
  const { deps, state } = setup({}, { fail: new Error("Stripe 503") });
  assertEquals((await handle(post({ action: "replay", eventId: EVENT }), deps)).status, 502);
  assertEquals(state.replays, []);
});

Deno.test("an event that wasn't kept can't be replayed", async () => {
  const { deps } = setup();
  assertEquals((await handle(post({ action: "replay", eventId: "evt_Other1" }), deps)).status, 404);
});

Deno.test("only billing staff and admins, with their own error code", async () => {
  const { deps, state } = setup({ isBilling: () => Promise.resolve(false) });
  const res = await handle(post({ action: "retry", referralId: REFERRAL }), deps);
  assertEquals([res.status, (await res.json()).error], [403, { code: "staff_only", message: "Only billing staff can retry referral credits." }]);
  assertEquals(state.started, []);
});

Deno.test("signed out: refused", async () => {
  const { deps } = setup({ requireUser: () => Promise.reject(new HttpError("unauthorized", "Log in to do that.")) });
  assertEquals((await handle(post({ action: "retry", referralId: REFERRAL }), deps)).status, 401);
});

Deno.test("an unknown referral, a bad id or an unknown action is refused", async () => {
  const { deps } = setup();
  assertEquals((await handle(post({ action: "retry", referralId: "44444444-4444-4444-8444-444444444444" }), deps)).status, 404);
  assertEquals((await handle(post({ action: "retry", referralId: "nope" }), deps)).status, 400);
  assertEquals((await handle(post({ action: "retry", referralId: REFERRAL, extra: 1 }), deps)).status, 400);
  assertEquals((await handle(post({ action: "replay", eventId: "x; drop" }), deps)).status, 400);
  assertEquals((await handle(post({ action: "explode" }), deps)).status, 400);
  assertEquals((await handle(post({}), deps)).status, 400);
});

Deno.test("Dismiss is refused while the referral still owes something", async () => {
  const { deps } = setup({ dismiss: () => Promise.reject(new Error("referral_still_owed: this referral still owes something")) });
  const res = await handle(post({ action: "dismiss", eventId: EVENT }), deps);
  assertEquals([res.status, (await res.json()).error.code], [409, "still_owed"]);
});

Deno.test("Dismiss takes a Stripe event id only", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ action: "dismiss", eventId: EVENT }), deps);
  assertEquals([res.status, await res.json()], [200, { dismissed: true }]);
  assertEquals((await handle(post({ action: "dismiss", eventId: "x; drop" }), deps)).status, 400);
  assertEquals(state.dismissed, [EVENT]);
});

Deno.test("GET is refused", async () => {
  const { deps } = setup();
  assertEquals((await handle(new Request("http://x", { method: "GET" }), deps)).status, 405);
});
