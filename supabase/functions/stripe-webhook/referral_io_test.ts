// deno test --allow-env supabase/functions/stripe-webhook — the real referral database and Stripe calls
// (referral_io.ts) with stubbed clients: error sorting, schema-cache retries and the balance search.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { PermanentFailure, type ReferralTransaction, SetAside } from "./handler.ts";
import { BALANCE_LOOKBACK, KEY_METADATA, referralDeps, type ReferralIo, reviewColumnsMissing, SCHEMA_RETRY_MS, stripeCall } from "./referral_io.ts";

const CUSTOMER = "cus_inviter";
const PAGE = 100;
const OLD_DESCRIPTION = "A month free: a friend you invited joined";
const OLD_PRICE_CENTS = 4000;
const NEW_PRICE_CENTS = 6000;
const DAY_S = 86_400;
const REFERRAL_A_MADE_S = 1_790_000_000;
const REFERRAL_B_MADE_S = REFERRAL_A_MADE_S + 10 * DAY_S;

interface Txn {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  metadata?: Record<string, string> | null;
}

const stripeError = (statusCode?: number, type?: string) => Object.assign(new Error(`stripe ${statusCode ?? "network"}`), { statusCode, type });

function setup(options: { txns?: Txn[]; rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { code?: string; message?: string } | null } } = {}) {
  const calls = { rpc: [] as [string, Record<string, unknown>][], sleeps: [] as number[], listed: 0, created: [] as unknown[] };
  // Newest first, as Stripe lists them.
  const txns = [...(options.txns ?? [])].sort((a, b) => b.created - a.created);
  const io: ReferralIo = {
    db: () => ({
      rpc: (fn, args) => {
        calls.rpc.push([fn, args]);
        return Promise.resolve(options.rpc ? options.rpc(fn, args) : { data: null, error: null });
      },
    }),
    stripe: () => ({
      customers: {
        listBalanceTransactions: (_customer, params) => {
          assertEquals(params.limit, PAGE);
          return (async function* () {
            for (const t of txns) {
              calls.listed += 1;
              yield t;
            }
          })();
        },
        createBalanceTransaction: (customer, params, options) => {
          calls.created.push({ customer, params, options });
          return Promise.resolve({ id: "cbtxn_new" });
        },
      },
      charges: { retrieve: () => Promise.resolve({ customer: CUSTOMER, payment_intent: "pi_1", refunded: true }) },
      invoicePayments: { list: () => Promise.resolve({ data: [{ invoice: "in_1" }] }) },
    }),
    sleep: (ms) => {
      calls.sleeps.push(ms);
      return Promise.resolve();
    },
  };
  return { deps: referralDeps(io), calls };
}

const txn = (overrides: Partial<ReferralTransaction> = {}): ReferralTransaction => ({
  referralId: "ref_a",
  side: "referrer",
  kind: "credit",
  round: 0,
  customer: CUSTOMER,
  cents: 800,
  currency: "usd",
  rule: "percent_20",
  createdAt: null,
  ...overrides,
});

// Sorting Stripe's answers --------------------------------------------------------------------------

Deno.test("401 and 403 from Stripe set the event aside for review", async () => {
  await assertRejects(() => stripeCall(() => Promise.reject(stripeError(401))), SetAside);
  await assertRejects(() => stripeCall(() => Promise.reject(stripeError(403))), SetAside);
  await assertRejects(() => stripeCall(() => Promise.reject(stripeError(undefined, "StripePermissionError"))), SetAside);
});

Deno.test("other 4xx answers are permanent", async () => {
  await assertRejects(() => stripeCall(() => Promise.reject(stripeError(400))), PermanentFailure);
  await assertRejects(() => stripeCall(() => Promise.reject(stripeError(404))), PermanentFailure);
});

Deno.test("5xx, 409, 429 and network failures are temporary: thrown as they are, never counted", async () => {
  for (const status of [500, 503, 409, 429, undefined]) {
    const err = await assertRejects(() => stripeCall(() => Promise.reject(stripeError(status))));
    assert(!(err instanceof PermanentFailure) && !(err instanceof SetAside), String(status));
  }
});

Deno.test("a successful call passes its answer through", async () => {
  assertEquals(await stripeCall(() => Promise.resolve("ok")), "ok");
});

// The database ------------------------------------------------------------------------------------

Deno.test("an unknown function (schema cache behind) is asked once more after a wait, with the same arguments", async () => {
  let first = true;
  const { deps, calls } = setup({
    rpc: () => {
      if (first) {
        first = false;
        return { data: null, error: { code: "PGRST202" } };
      }
      return { data: [{ referral_id: "ref_a", side: "friend", kind: "credit", round: 0, customer: CUSTOMER, cents: 600, currency: "usd", reward_rule: "percent_20", created_at: null }], error: null };
    },
  });
  const owed = await deps.claimReferral("user_1", "in_1");
  assertEquals(owed.length, 1);
  assertEquals(calls.sleeps, [SCHEMA_RETRY_MS]);
  assertEquals(calls.rpc.map(([fn, args]) => [fn, args]), [
    ["claim_referral_reward", { p_referred: "user_1", p_invoice: "in_1" }],
    ["claim_referral_reward", { p_referred: "user_1", p_invoice: "in_1" }],
  ]);
});

Deno.test("still unknown after the wait: set aside, never called without the invoice", async () => {
  const { deps, calls } = setup({ rpc: () => ({ data: null, error: { code: "PGRST202" } }) });
  await assertRejects(() => deps.reverseReferral("user_1", "in_1"), SetAside);
  assertEquals(calls.rpc.length, 2);
  assert(calls.rpc.every(([, args]) => args.p_invoice === "in_1"));
});

Deno.test("another database error is temporary: thrown as it is", async () => {
  const { deps } = setup({ rpc: () => ({ data: null, error: { code: "57014", message: "statement timeout" } }) });
  const err = await assertRejects(() => deps.claimReferral("user_1", "in_1"));
  assert(!(err instanceof SetAside) && !(err instanceof PermanentFailure));
});

Deno.test("whether a refund could take anything back is asked of the database; unknown means no", async () => {
  assertEquals(await setup({ rpc: () => ({ data: true, error: null }) }).deps.takeBackPossible("cus_1"), true);
  assertEquals(await setup({ rpc: () => ({ data: false, error: null }) }).deps.takeBackPossible(null), false);
  assertEquals(await setup({ rpc: () => ({ data: null, error: { code: "PGRST202" } }) }).deps.takeBackPossible("cus_1"), false);
});

Deno.test("a transaction id recorded elsewhere is a permanent failure; other record errors are temporary", async () => {
  const reused = setup({ rpc: () => ({ data: null, error: { code: "P0001", message: "referral_txn_reused: cbtxn_1 is already recorded" } }) });
  await assertRejects(() => reused.deps.recordReferralTransaction(txn(), "cbtxn_1"), PermanentFailure);
  const down = setup({ rpc: () => ({ data: null, error: { code: "08006", message: "connection failure" } }) });
  const err = await assertRejects(() => down.deps.recordReferralTransaction(txn(), "cbtxn_1"));
  assert(!(err instanceof PermanentFailure));
});

Deno.test("a credit check is recorded as the side's credit; a failure is counted with its message", async () => {
  const { deps, calls } = setup({ rpc: () => ({ data: true, error: null }) });
  await deps.recordReferralTransaction(txn({ kind: "credit_check", round: 1 }), "cbtxn_9");
  assertEquals(calls.rpc[0], ["record_referral_transaction", { p_referral: "ref_a", p_side: "referrer", p_kind: "credit", p_round: 1, p_txn: "cbtxn_9" }]);
  assertEquals(await deps.noteReferralFailure(txn(), "Stripe 400: no such customer"), true);
  assertEquals(calls.rpc[1], ["note_referral_failure", { p_referral: "ref_a", p_side: "referrer", p_error: "Stripe 400: no such customer" }]);
});

// Finding a transaction already made ----------------------------------------------------------------

Deno.test("a transaction with its key is found past the first page of 100", async () => {
  const filler: Txn[] = Array.from({ length: 150 }, (_, i) => ({ id: `cbtxn_f${i}`, amount: -1, currency: "usd", description: "other", created: 2_000_000_000 - i }));
  const target: Txn = { id: "cbtxn_target", amount: -600, currency: "usd", description: "x", created: 1_000, metadata: { [KEY_METADATA]: "referral20-ref_a-friend" } };
  const { deps } = setup({ txns: [...filler, target] });
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "referral20-ref_a-friend"), "cbtxn_target");
});

Deno.test("the search stops after the latest few hundred transactions", async () => {
  const many: Txn[] = Array.from({ length: BALANCE_LOOKBACK + 50 }, (_, i) => ({ id: `cbtxn_m${i}`, amount: -1, currency: "usd", description: "other", created: 2_000_000_000 - i }));
  const { deps, calls } = setup({ txns: many });
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "referral20-ref_a-friend"), null);
  assertEquals(calls.listed, BALANCE_LOOKBACK);
});

Deno.test("two old free months for the same inviter, at two prices: each referral finds its own, never one already recorded", async () => {
  const first: Txn = { id: "cbtxn_old_a", amount: -OLD_PRICE_CENTS, currency: "usd", description: OLD_DESCRIPTION, created: REFERRAL_A_MADE_S + DAY_S };
  const second: Txn = { id: "cbtxn_old_b", amount: -NEW_PRICE_CENTS, currency: "usd", description: OLD_DESCRIPTION, created: REFERRAL_B_MADE_S + DAY_S };
  const otherCurrency: Txn = { id: "cbtxn_eur", amount: -NEW_PRICE_CENTS, currency: "eur", description: OLD_DESCRIPTION, created: REFERRAL_B_MADE_S + 2 * DAY_S };
  const recorded = new Set<string>();
  const { deps } = setup({
    txns: [first, second, otherCurrency],
    rpc: (fn, args) => ({ data: fn === "referral_transaction_known" ? recorded.has(args.p_txn as string) : null, error: null }),
  });
  const since = (s: number) => new Date(s * 1000).toISOString();
  const unmarked = (madeAt: number) => ({ description: OLD_DESCRIPTION, currency: "usd", since: since(madeAt) });
  // Referral A (made first) finds the oldest one after it, whatever its amount.
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "referral-ref_a-referrer", unmarked(REFERRAL_A_MADE_S)), "cbtxn_old_a");
  recorded.add("cbtxn_old_a");
  // Referral B only looks after it was made, and skips what A recorded.
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "referral-ref_b-referrer", unmarked(REFERRAL_B_MADE_S)), "cbtxn_old_b");
  recorded.add("cbtxn_old_b");
  // Nothing left in USD: never the euro one, never one already recorded.
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "referral-ref_c-referrer", unmarked(REFERRAL_A_MADE_S)), null);
});

Deno.test("without an unmarked match asked for, a transaction with no key is never taken", async () => {
  const old: Txn = { id: "cbtxn_old", amount: -600, currency: "usd", description: OLD_DESCRIPTION, created: 1 };
  assertEquals(await setup({ txns: [old] }).deps.findBalanceTransaction(CUSTOMER, "referral20-ref_a-friend"), null);
});

Deno.test("every transaction made carries its key in the metadata and as its idempotency key", async () => {
  const { deps, calls } = setup();
  await deps.adjustBalance(CUSTOMER, -600, "eur", "referral20-ref_a-friend", "d");
  await deps.creditCustomer("cus_aff", 300, "affiliate-aff_1", "a");
  assertEquals(calls.created, [
    { customer: CUSTOMER, params: { amount: -600, currency: "eur", description: "d", metadata: { [KEY_METADATA]: "referral20-ref_a-friend" } }, options: { idempotencyKey: "referral20-ref_a-friend" } },
    { customer: "cus_aff", params: { amount: -300, currency: "usd", description: "a", metadata: { [KEY_METADATA]: "affiliate-aff_1" } }, options: { idempotencyKey: "affiliate-aff_1" } },
  ]);
});

Deno.test("a charge's invoice is found through its payment intent", async () => {
  assertEquals(await setup().deps.chargeDetails("ch_1"), { customer: CUSTOMER, refunded: true, invoiceId: "in_1" });
});

Deno.test("an old affiliate credit is matched by amount too, never another amount", async () => {
  const description = "Affiliate commission: 20% of a referred member's first payment";
  const made = REFERRAL_A_MADE_S + DAY_S;
  const other: Txn = { id: "cbtxn_other", amount: -999, currency: "usd", description, created: made };
  const right: Txn = { id: "cbtxn_right", amount: -600, currency: "usd", description, created: made + 1 };
  const { deps } = setup({ txns: [other, right], rpc: () => ({ data: false, error: null }) });
  const since = new Date(REFERRAL_A_MADE_S * 1000).toISOString();
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "affiliate-aff_1", { description, currency: "usd", since, amountCents: -600 }), "cbtxn_right");
  assertEquals(await deps.findBalanceTransaction(CUSTOMER, "affiliate-aff_1", { description, currency: "usd", since, amountCents: -1 }), null);
});

Deno.test("what a referral still owes is asked of referral_owed()", async () => {
  const { deps, calls } = setup({ rpc: () => ({ data: [], error: null }) });
  assertEquals(await deps.referralOwed("ref_a"), []);
  assertEquals(calls.rpc[0], ["referral_owed", { p_referral: "ref_a" }]);
});

Deno.test("before the migrations, a missing review column lets the event be recorded without its note", () => {
  assertEquals(reviewColumnsMissing({ code: "PGRST204", message: "Could not find the 'review_payload' column of 'stripe_events' in the schema cache" }), true);
  assertEquals(reviewColumnsMissing({ code: "42703", message: 'column "review_reason" of relation "stripe_events" does not exist' }), true);
  assertEquals(reviewColumnsMissing({ code: "PGRST204", message: "Could not find the 'other' column" }), false);
  assertEquals(reviewColumnsMissing({ code: "23505", message: "review_reason" }), false);
  assertEquals(reviewColumnsMissing(null), false);
});
