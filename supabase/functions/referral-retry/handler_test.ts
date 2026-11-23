// deno test --allow-env supabase/functions/referral-retry
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { HttpError } from "../_shared/http.ts";
import { type ReferralTransaction, SetAside } from "../stripe-webhook/handler.ts";
import { type Deps, handle } from "./handler.ts";

const REFERRAL = "11111111-1111-4111-8111-111111111111";
const FRIEND = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const EVENT = "evt_1Abc";

const owedCredit: ReferralTransaction = {
  referralId: REFERRAL, side: "friend", kind: "credit", round: 0, customer: "cus_f", cents: 600, currency: "usd", rule: "percent_20", createdAt: null,
};

function setup(over: Partial<Deps> = {}, stripe: { fail?: Error } = {}) {
  const state = { owed: [owedCredit] as ReferralTransaction[], made: [] as string[], started: [] as string[], dismissed: [] as string[] };
  const deps: Deps = {
    requireUser: () => Promise.resolve({ id: STAFF }),
    isBilling: () => Promise.resolve(true),
    start: (id) => {
      state.started.push(id);
      return Promise.resolve(id === REFERRAL ? FRIEND : null);
    },
    dismiss: (id) => {
      state.dismissed.push(id);
      return Promise.resolve(true);
    },
    settle: {
      referralOwed: () => Promise.resolve([...state.owed]),
      findBalanceTransaction: () => Promise.resolve(null),
      adjustBalance: (_c, _a, _cur, key) => {
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
    },
    ...over,
  };
  return { deps, state };
}

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify(body) });

Deno.test("Retry now clears the held sides and makes what's still owed, once", async () => {
  const { deps, state } = setup();
  const res = await handle(post({ action: "retry", referralId: REFERRAL }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { owed: 0, held: false, reason: null });
  assertEquals([state.started, state.made], [[REFERRAL], [`referral20-${REFERRAL}-friend`]]);
});

Deno.test("only billing staff and admins", async () => {
  const { deps, state } = setup({ isBilling: () => Promise.resolve(false) });
  assertEquals((await handle(post({ action: "retry", referralId: REFERRAL }), deps)).status, 403);
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
  assertEquals((await handle(post({ action: "explode" }), deps)).status, 400);
  assertEquals((await handle(post({}), deps)).status, 400);
});

Deno.test("Stripe still refusing our key or not answering: an error, nothing recorded", async () => {
  const refused = setup({}, { fail: new SetAside("Stripe refused the key: no rights") });
  const r1 = await handle(post({ action: "retry", referralId: REFERRAL }), refused.deps);
  assertEquals(r1.status, 200);
  assertEquals((await r1.json()).held, true);
  const down = setup({}, { fail: new Error("Stripe 503") });
  assertEquals((await handle(post({ action: "retry", referralId: REFERRAL }), down.deps)).status, 502);
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
