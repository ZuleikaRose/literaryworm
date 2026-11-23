// deno test --allow-env supabase/functions/stripe-webhook — refer a friend in stripe-webhook, offline.
// The database is a small model of migration 6843 (claim, take back, give back, record, checks, failures,
// what's still owed), and Stripe a model of customer balances with idempotency keys that expire after a day.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import type { Stripe } from "../_shared/stripe.ts";
import { type Deps, handle, PermanentFailure, type ReferralRule, type ReferralTransaction, referralKey, SetAside } from "./handler.ts";

const FRIEND = "00000000-0000-0000-0000-0000000000f1";
const FRIEND_CUSTOMER = "cus_friend";
const INVITER_CUSTOMER = "cus_inviter";
const STRANGER_CUSTOMER = "cus_stranger";
const REFERRAL = "ref_1";
const FIRST_INVOICE = "in_first";
const LATER_INVOICE = "in_second";
const FIRST_CHARGE = "ch_first";
const LATER_CHARGE = "ch_second";
const STRANGER_CHARGE = "ch_stranger";
// 20% of one month: Basic monthly ($30.00) for the friend, Premium yearly ($600.00 / 12) for the inviter.
const FRIEND_CENTS = 600;
const INVITER_CENTS = 1000;
const FREE_MONTH_FRIEND_CENTS = 3000;
const FREE_MONTH_INVITER_CENTS = 6000;
const PLAN_PRICE_CENTS = 3000;
const AFFILIATE_CENTS = 600;
const DAY_MS = 86_400_000;
const IDEMPOTENCY_KEY_LIFETIME_MS = DAY_MS;
const FAILURES_BEFORE_REVIEW = 5;
const REFERRAL_MADE_AT = "2026-11-01T00:00:00.000Z";
const ALL_RECORD_TRIES = 3;

type Side = "friend" | "referrer";
type Kind = ReferralTransaction["kind"];

interface SideRow {
  cents: number | null;
  currency: string;
  customer: string;
  credit: string | null;
  reversal: string | null;
  recredit: string | null;
  failures: number;
  needsReview: boolean;
  checkedRound: number;
}

interface Row {
  rule: ReferralRule;
  decided: boolean;
  firstInvoice: string | null;
  reversed: boolean;
  round: number;
  sides: Record<Side, SideRow>;
}

interface Txn {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  key: string | null;
  description: string;
}

interface Options {
  rule?: ReferralRule;
  inviterCents?: number | null;
  inviterCurrency?: string;
}

const sideRow = (cents: number | null, customer: string, currency = "usd"): SideRow => ({
  cents,
  currency,
  customer,
  credit: null,
  reversal: null,
  recredit: null,
  failures: 0,
  needsReview: false,
  checkedRound: 0,
});

function world(first: Stripe.Event, options: Options = {}) {
  let ev = first;
  const rule = options.rule ?? "percent_20";
  const row: Row = {
    rule,
    decided: false,
    firstInvoice: null,
    reversed: false,
    round: 0,
    sides: {
      friend: sideRow(rule === "free_month" ? FREE_MONTH_FRIEND_CENTS : FRIEND_CENTS, FRIEND_CUSTOMER),
      referrer: sideRow(
        options.inviterCents === undefined ? (rule === "free_month" ? FREE_MONTH_INVITER_CENTS : INVITER_CENTS) : options.inviterCents,
        INVITER_CUSTOMER,
        options.inviterCurrency,
      ),
    },
  };
  const stripe = {
    now: 0,
    txns: [] as Txn[],
    keys: new Map<string, { at: number; id: string }>(),
    affiliateKeys: new Map<string, { at: number; id: string }>(),
    affiliateMade: new Map<string, string>(),
    /** Keys Stripe refuses for good (a 4xx such as a deleted customer). */
    fail: new Set<string>(),
    /** Keys Stripe fails for now (5xx, network, 409, 429). */
    transient: new Set<string>(),
    /** Stripe refuses our key (missing rights) for every call. */
    refuse: false,
    calls: 0,
    charges: new Map<string, { customer: string; refunded: boolean; invoiceId: string | null }>([
      [FIRST_CHARGE, { customer: FRIEND_CUSTOMER, refunded: false, invoiceId: FIRST_INVOICE }],
      [LATER_CHARGE, { customer: FRIEND_CUSTOMER, refunded: false, invoiceId: LATER_INVOICE }],
      [STRANGER_CHARGE, { customer: STRANGER_CUSTOMER, refunded: false, invoiceId: "in_stranger" }],
    ]),
  };
  const db = {
    failRecord: 0,
    /** The database functions aren't there yet (PGRST202 even after the wait). */
    missing: false,
    handled: [] as { id: string; review: boolean }[],
    affiliatePaid: 0,
    /** Run once, just before a transaction is recorded (another event landing in between). */
    beforeRecord: null as null | (() => Promise<void>),
    lastError: null as string | null,
    affiliateRecordFails: 0,
    affiliateReleased: 0,
  };

  const pending = (): ReferralTransaction[] => {
    if (!row.decided) return [];
    const out: ReferralTransaction[] = [];
    for (const name of ["friend", "referrer"] as Side[]) {
      const s = row.sides[name];
      if (s.cents === null || s.needsReview) continue;
      let kind: Kind | null = null;
      if (!row.reversed && !s.credit) kind = "credit";
      else if (row.rule !== "percent_20") kind = null;
      else if (row.reversed && !s.credit && s.checkedRound < row.round) kind = "credit_check";
      else if (row.reversed && s.credit && !s.reversal) kind = "reversal";
      else if (!row.reversed && row.round > 0 && s.reversal && !s.recredit) kind = "recredit";
      if (kind) out.push({ referralId: REFERRAL, side: name, kind, round: row.round, customer: s.customer, cents: s.cents, currency: s.currency, rule: row.rule, createdAt: REFERRAL_MADE_AT });
    }
    return out;
  };
  const owes = (...kinds: Kind[]) => pending().some((t) => kinds.includes(t.kind));

  const balance = (customer: string) => stripe.txns.filter((t) => t.customer === customer).reduce((sum, t) => sum + t.amount, 0);
  const stripeGate = () => {
    stripe.calls += 1;
    if (stripe.refuse) throw new SetAside("Stripe refused the key");
  };
  const dbGate = () => {
    if (db.missing) throw new SetAside("migration 6843 isn't there");
  };

  const deps: Deps = {
    verify: (_body, signature) => (signature === "good" ? Promise.resolve(ev) : Promise.reject(new Error("bad"))),
    alreadyHandled: () => Promise.resolve(false),
    markHandled: (e, review) => {
      db.handled.push({ id: e.id, review });
      return Promise.resolve();
    },
    userForCustomer: (c) => Promise.resolve(c === FRIEND_CUSTOMER ? FRIEND : c === STRANGER_CUSTOMER ? "stranger" : null),
    isStaff: () => Promise.resolve(false),
    recordCardPayment: () => Promise.resolve(),
    getSubscription: () =>
      Promise.resolve({
        id: "sub_1",
        customer: FRIEND_CUSTOMER,
        status: "active",
        pause_collection: null,
        cancel_at_period_end: false,
        billing_cycle_anchor: 1_797_552_000,
        items: { data: [{ price: { lookup_key: "literaryworm_basic_monthly" }, current_period_end: 1_798_761_600 }] },
      } as unknown as Stripe.Subscription),
    startMembership: () => Promise.resolve(),
    updateMembership: () => Promise.resolve(true),
    cancelNow: () => Promise.resolve(),
    createGift: () => Promise.resolve(),
    deleteDraftInvoice: () => Promise.resolve(),
    claimReferral: (_userId, invoiceId) => {
      dbGate();
      if (!row.decided) {
        row.decided = true;
        row.firstInvoice = invoiceId;
      }
      return Promise.resolve(pending());
    },
    reverseReferral: (_userId, invoiceId) => {
      dbGate();
      if (row.rule !== "percent_20" || !row.decided || row.firstInvoice !== invoiceId) return Promise.resolve([]);
      if (!row.reversed && !owes("recredit")) {
        row.reversed = true;
        row.round += 1;
        row.sides.friend.reversal = null;
        row.sides.referrer.reversal = null;
      }
      return Promise.resolve(pending());
    },
    restoreReferral: (_userId, invoiceId) => {
      dbGate();
      if (row.rule !== "percent_20" || row.firstInvoice !== invoiceId) return Promise.resolve([]);
      if (row.reversed && !owes("reversal", "credit_check")) {
        row.reversed = false;
        row.sides.friend.recredit = null;
        row.sides.referrer.recredit = null;
      }
      return Promise.resolve(pending());
    },
    takeBackPossible: (customer) => Promise.resolve(row.decided && row.rule === "percent_20" && (customer === null || customer === FRIEND_CUSTOMER)),
    findBalanceTransaction: (customer, key, unmarked) => {
      stripeGate();
      if (customer === "cus_aff") return Promise.resolve(stripe.affiliateMade.get(key) ?? null);
      const marked = stripe.txns.find((t) => t.customer === customer && t.key === key);
      if (marked) return Promise.resolve(marked.id);
      const recorded = new Set(Object.values(row.sides).flatMap((x) => [x.credit, x.reversal, x.recredit]));
      const old = unmarked
        ? stripe.txns.find((t) => t.customer === customer && !t.key && t.currency === unmarked.currency && t.description === unmarked.description && !recorded.has(t.id))
        : undefined;
      return Promise.resolve(old?.id ?? null);
    },
    adjustBalance: (customer, amount, currency, key, description) => {
      stripeGate();
      if (stripe.fail.has(key)) return Promise.reject(new PermanentFailure("Stripe 400: no such customer"));
      if (stripe.transient.has(key)) return Promise.reject(new Error("Stripe 503"));
      const used = stripe.keys.get(key);
      if (used && stripe.now - used.at < IDEMPOTENCY_KEY_LIFETIME_MS) return Promise.resolve(used.id);
      const id = `cbtxn_${stripe.txns.length + 1}`;
      stripe.txns.push({ id, customer, amount, currency, key, description });
      stripe.keys.set(key, { at: stripe.now, id });
      return Promise.resolve(id);
    },
    recordReferralTransaction: async (txn, id) => {
      if (db.beforeRecord) {
        const hook = db.beforeRecord;
        db.beforeRecord = null;
        await hook();
      }
      if (db.failRecord > 0) {
        db.failRecord -= 1;
        throw new Error("db down");
      }
      const s = row.sides[txn.side];
      if (txn.kind === "credit" || txn.kind === "credit_check") s.credit ??= id;
      else if (txn.round === row.round && txn.kind === "reversal") s.reversal ??= id;
      else if (txn.round === row.round) s.recredit ??= id;
      s.failures = 0;
    },
    recordReferralCheck: (txn) => {
      const s = row.sides[txn.side];
      s.checkedRound = Math.max(s.checkedRound, txn.round);
      return Promise.resolve();
    },
    noteReferralFailure: (txn, message) => {
      const s = row.sides[txn.side];
      db.lastError = message;
      s.failures += 1;
      s.needsReview ||= s.failures >= FAILURES_BEFORE_REVIEW;
      return Promise.resolve(s.needsReview);
    },
    chargeDetails: (chargeId) => {
      stripeGate();
      return Promise.resolve(stripe.charges.get(chargeId) ?? { customer: null, refunded: false, invoiceId: null });
    },
    creditCustomer: (_customer, _cents, key) => {
      // The affiliate's balance, kept apart from the referral sides; keys last a day, as at Stripe.
      const used = stripe.affiliateKeys.get(key);
      if (used && stripe.now - used.at < IDEMPOTENCY_KEY_LIFETIME_MS) return Promise.resolve(used.id);
      db.affiliatePaid += 1;
      const id = `cbtxn_aff_${db.affiliatePaid}`;
      stripe.affiliateKeys.set(key, { at: stripe.now, id });
      stripe.affiliateMade.set(key, id);
      return Promise.resolve(id);
    },
    claimAffiliate: () => Promise.resolve({ referralId: "aff_1", affiliateCustomer: "cus_aff", cents: AFFILIATE_CENTS }),
    recordAffiliateCredit: () => {
      if (db.affiliateRecordFails > 0) {
        db.affiliateRecordFails -= 1;
        return Promise.reject(new Error("db down"));
      }
      return Promise.resolve();
    },
    releaseAffiliate: () => {
      db.affiliateReleased += 1;
      return Promise.resolve();
    },
    notifyPaymentFailed: () => Promise.resolve(),
    addVoicePack: () => Promise.resolve(),
  };
  const post = () => new Request("http://x", { method: "POST", headers: { "Stripe-Signature": "good" }, body: "{}" });
  const run = async (next?: Stripe.Event) => {
    if (next) ev = next;
    return (await handle(post(), deps)).status;
  };
  /** Handles another event on the same database and Stripe without changing this world's current event. */
  const runOther = async (other: Stripe.Event) => (await handle(post(), { ...deps, verify: () => Promise.resolve(other) })).status;
  return { row, stripe, db, deps, run, runOther, balance };
}

const event = (type: string, object: Record<string, unknown>): Stripe.Event => ({ id: `evt_${type}`, type, livemode: false, data: { object } }) as unknown as Stripe.Event;
const paid = (invoice = FIRST_INVOICE, amount_paid = PLAN_PRICE_CENTS) =>
  event("invoice.paid", { id: invoice, customer: FRIEND_CUSTOMER, amount_paid, parent: { subscription_details: { subscription: "sub_1" } } });
const refunded = (charge: string, full: boolean, customer = FRIEND_CUSTOMER) => event("charge.refunded", { id: charge, customer, refunded: full });
const disputed = (charge: string) => event("charge.dispute.created", { id: "dp_1", charge });
const disputeClosed = (charge: string, status: string) => event("charge.dispute.closed", { id: "dp_1", charge, status });
const keyOf = (s: Side, kind: Kind = "credit", round = 0, rule: ReferralRule = "percent_20") => referralKey({ referralId: REFERRAL, side: s, kind, round, rule });
const lastReview = (w: ReturnType<typeof world>) => w.db.handled.at(-1)?.review;

// Credits ---------------------------------------------------------------------------------------------

Deno.test("the friend's first payment credits 20% of a month to each side, in each side's own currency", async () => {
  const w = world(paid(), { inviterCurrency: "eur" });
  assertEquals(await w.run(), 200);
  assertEquals(
    w.stripe.txns.map((t) => [t.customer, t.amount, t.currency, t.key, t.description]),
    [
      [FRIEND_CUSTOMER, -FRIEND_CENTS, "usd", "referral20-ref_1-friend", "20% off one month: you joined with a friend's invitation"],
      [INVITER_CUSTOMER, -INVITER_CENTS, "eur", "referral20-ref_1-referrer", "20% off one month: a friend you invited joined"],
    ],
  );
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", "cbtxn_2"]);
  assertEquals(w.row.firstInvoice, FIRST_INVOICE);
});

Deno.test("an inviter who already had their 20% gets nothing more; the friend still gets theirs", async () => {
  const w = world(paid(), { inviterCents: null });
  await w.run();
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend")]);
});

Deno.test("a free month is credited as a free month, with its old keys", async () => {
  const w = world(paid(), { rule: "free_month" });
  await w.run();
  assertEquals(
    w.stripe.txns.map((t) => [t.amount, t.key, t.description]),
    [
      [-FREE_MONTH_FRIEND_CENTS, "referral-ref_1-friend", "A month free: you joined with a friend's invitation"],
      [-FREE_MONTH_INVITER_CENTS, "referral-ref_1-referrer", "A month free: a friend you invited joined"],
    ],
  );
});

Deno.test("a free month made before keys were kept is found by description and currency, never made again", async () => {
  const w = world(paid(), { rule: "free_month" });
  w.stripe.txns.push({ id: "cbtxn_old", customer: FRIEND_CUSTOMER, amount: -FREE_MONTH_FRIEND_CENTS, currency: "usd", key: null, description: "A month free: you joined with a friend's invitation" });
  w.stripe.now += 2 * DAY_MS;
  await w.run();
  assertEquals(w.row.sides.friend.credit, "cbtxn_old");
  assertEquals(w.stripe.txns.filter((t) => t.customer === FRIEND_CUSTOMER).length, 1);
});

Deno.test("an unmarked transaction isn't taken for a 20% credit", async () => {
  const w = world(paid());
  w.stripe.txns.push({ id: "cbtxn_other", customer: FRIEND_CUSTOMER, amount: -FRIEND_CENTS, currency: "usd", key: null, description: "20% off one month: you joined with a friend's invitation" });
  await w.run();
  assertEquals(w.row.sides.friend.credit, "cbtxn_2");
});

Deno.test("nothing charged rewards nothing yet", async () => {
  const w = world(paid(FIRST_INVOICE, 0));
  await w.run();
  assertEquals(w.stripe.txns, []);
  assertEquals(w.row.decided, false);
});

// Retries and failures ------------------------------------------------------------------------------

Deno.test("friend credited, inviter fails: the friend's credit is kept and the retry makes only the inviter's", async () => {
  const w = world(paid());
  w.stripe.fail.add(keyOf("referrer"));
  assertEquals(await w.run(), 500);
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", null]);
  w.stripe.fail.clear();
  assertEquals(await w.run(), 200);
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend"), keyOf("referrer")]);
});

Deno.test("a retry more than a day later, after the record failed, finds the credit at Stripe instead of making another", async () => {
  const w = world(paid());
  w.db.failRecord = 2 * ALL_RECORD_TRIES;
  assertEquals(await w.run(), 500);
  assertEquals(w.stripe.txns.length, 2);
  w.stripe.now += 2 * DAY_MS;
  assertEquals(await w.run(), 200);
  assertEquals(w.stripe.txns.length, 2);
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", "cbtxn_2"]);
});

Deno.test("a record that fails once is tried again at once", async () => {
  const w = world(paid());
  w.db.failRecord = 1;
  assertEquals(await w.run(), 200);
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", "cbtxn_2"]);
});

Deno.test("every later paid invoice credits nothing more", async () => {
  const w = world(paid());
  await w.run();
  w.stripe.now += 31 * DAY_MS;
  await w.run(paid(LATER_INVOICE));
  await w.run(paid(LATER_INVOICE));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("a side that keeps failing is set aside for review after 5 tries, and later invoices go through", async () => {
  const w = world(paid());
  w.stripe.fail.add(keyOf("referrer"));
  for (let attempt = 1; attempt < FAILURES_BEFORE_REVIEW; attempt++) assertEquals(await w.run(), 500);
  assertEquals(await w.run(), 200);
  assertEquals(w.row.sides.referrer.needsReview, true);
  assertEquals(lastReview(w), true);
  assertEquals(await w.run(paid(LATER_INVOICE)), 200);
  assertEquals(lastReview(w), false);
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend")]);
});

Deno.test("temporary Stripe failures are never counted: the side is never set aside, and Stripe retries", async () => {
  const w = world(paid());
  w.stripe.transient.add(keyOf("referrer"));
  const MANY_RETRIES = 3 * FAILURES_BEFORE_REVIEW;
  for (let attempt = 0; attempt < MANY_RETRIES; attempt++) assertEquals(await w.run(), 500);
  assertEquals([w.row.sides.referrer.failures, w.row.sides.referrer.needsReview], [0, false]);
  w.stripe.transient.clear();
  assertEquals(await w.run(), 200);
  assertEquals(w.row.sides.referrer.credit, "cbtxn_2");
});

Deno.test("a permanent failure's message is kept for the team", async () => {
  const w = world(paid());
  w.stripe.fail.add(keyOf("referrer"));
  await w.run();
  assertEquals(w.db.lastError, "Stripe 400: no such customer");
});

Deno.test("a late retry of an affiliate commission finds it at Stripe instead of paying it twice", async () => {
  const w = world(paid(FIRST_INVOICE, 0));
  w.db.affiliateRecordFails = 1;
  const affiliateEvent = paid();
  w.row.decided = true; // Nothing to do for the referral here.
  w.row.sides.friend.credit = "cbtxn_x";
  w.row.sides.referrer.credit = "cbtxn_y";
  assertEquals(await w.run(affiliateEvent), 500);
  assertEquals(w.db.affiliateReleased, 1);
  w.stripe.now += 2 * DAY_MS;
  assertEquals(await w.run(affiliateEvent), 200);
  assertEquals(w.db.affiliatePaid, 1);
});

Deno.test("a failing referral doesn't stop the affiliate's commission", async () => {
  const w = world(paid());
  w.stripe.fail.add(keyOf("referrer"));
  assertEquals(await w.run(), 500);
  assertEquals(w.db.affiliatePaid, 1);
});

Deno.test("Stripe refusing our key sets the referral aside for review instead of failing for days", async () => {
  const w = world(paid());
  w.stripe.refuse = true;
  assertEquals(await w.run(), 200);
  assertEquals(lastReview(w), true);
  // The affiliate's commission needs the same key: handed back for the team, not paid.
  assertEquals([w.db.affiliatePaid, w.db.affiliateReleased], [0, 1]);
});

Deno.test("while the database functions aren't there yet, the referral is set aside for review", async () => {
  const w = world(paid());
  w.db.missing = true;
  assertEquals(await w.run(), 200);
  assertEquals(lastReview(w), true);
  assertEquals(w.stripe.txns, []);
});

// Taking back -----------------------------------------------------------------------------------------

Deno.test("a full refund of the first payment takes both credits back, once", async () => {
  const w = world(paid());
  await w.run();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  assertEquals(await w.run(refunded(FIRST_CHARGE, true)), 200);
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals(
    w.stripe.txns.slice(2).map((t) => [t.customer, t.amount, t.key, t.description]),
    [
      [FRIEND_CUSTOMER, FRIEND_CENTS, "referral20-ref_1-friend-reversal-1", "20% referral credit taken back: the first payment was refunded or disputed"],
      [INVITER_CUSTOMER, INVITER_CENTS, "referral20-ref_1-referrer-reversal-1", "20% referral credit taken back: the first payment was refunded or disputed"],
    ],
  );
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
});

Deno.test("a partial refund takes nothing back", async () => {
  const w = world(paid());
  await w.run();
  await w.run(refunded(FIRST_CHARGE, false));
  assertEquals(w.stripe.txns.length, 2);
  assertEquals(w.row.reversed, false);
});

Deno.test("a refund of a later payment takes nothing back", async () => {
  const w = world(paid());
  await w.run();
  w.stripe.charges.get(LATER_CHARGE)!.refunded = true;
  await w.run(refunded(LATER_CHARGE, true));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("a refund for someone with no referral is passed over without asking Stripe", async () => {
  const w = world(paid());
  await w.run();
  const calls = w.stripe.calls;
  w.stripe.refuse = true;
  assertEquals(await w.run(refunded(STRANGER_CHARGE, true, STRANGER_CUSTOMER)), 200);
  assertEquals(w.stripe.calls, calls);
});

Deno.test("a dispute when nobody's 20% could be taken back doesn't ask Stripe", async () => {
  const w = world(paid(), { rule: "free_month" });
  await w.run();
  const calls = w.stripe.calls;
  await w.run(disputed(FIRST_CHARGE));
  assertEquals(w.stripe.calls, calls);
});

Deno.test("a refund after the credit was used still takes it back: it's owed on the next bill", async () => {
  const w = world(paid());
  await w.run();
  w.stripe.txns.push({ id: "cbtxn_used", customer: FRIEND_CUSTOMER, amount: FRIEND_CENTS, currency: "usd", key: "invoice", description: "applied" });
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals(w.balance(FRIEND_CUSTOMER), FRIEND_CENTS);
});

Deno.test("a free month is never taken back", async () => {
  const w = world(paid(), { rule: "free_month" });
  await w.run();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  await w.run(disputed(FIRST_CHARGE));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("a refund before the inviter's credit was made: the friend's is taken back, the inviter's never made", async () => {
  const w = world(paid());
  w.stripe.fail.add(keyOf("referrer"));
  await w.run();
  w.stripe.fail.clear();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  await w.run(paid(LATER_INVOICE));
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend"), keyOf("friend", "reversal", 1)]);
});

Deno.test("credits made at Stripe but not recorded before a refund are found and taken back too", async () => {
  const w = world(paid());
  w.db.failRecord = 2 * ALL_RECORD_TRIES; // Both credits are made, neither is recorded.
  assertEquals(await w.run(), 500);
  w.stripe.now += 2 * DAY_MS;
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  assertEquals(await w.run(refunded(FIRST_CHARGE, true)), 200);
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
  assertEquals(w.stripe.txns.length, 4);
});

Deno.test("a refund landing while a credit is being made: the credit is taken back once it's recorded", async () => {
  const w = world(paid());
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  // The refund is handled after the friend's credit is made at Stripe and before it's recorded.
  w.db.beforeRecord = async () => {
    await w.runOther(refunded(FIRST_CHARGE, true));
  };
  assertEquals(await w.run(), 200);
  assertEquals(w.row.reversed, true);
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
});

Deno.test("a reversal that fails for one side is retried for that side only", async () => {
  const w = world(paid());
  await w.run();
  w.stripe.fail.add(keyOf("referrer", "reversal", 1));
  assertEquals(await w.run(disputed(FIRST_CHARGE)), 500);
  w.stripe.fail.clear();
  assertEquals(await w.run(disputed(FIRST_CHARGE)), 200);
  assertEquals(w.stripe.txns.slice(2).map((t) => t.key), [keyOf("friend", "reversal", 1), keyOf("referrer", "reversal", 1)]);
});

Deno.test("a dispute takes both back; won, they're added again; a lost one changes nothing more", async () => {
  const w = world(paid());
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [-FRIEND_CENTS, -INVITER_CENTS]);
  assertEquals(w.stripe.txns.slice(4).map((t) => [t.key, t.description]), [
    [keyOf("friend", "recredit", 1), "20% referral credit added again: the dispute was closed in our favour"],
    [keyOf("referrer", "recredit", 1), "20% referral credit added again: the dispute was closed in our favour"],
  ]);

  const lost = world(paid());
  await lost.run();
  await lost.run(disputed(FIRST_CHARGE));
  await lost.run(disputeClosed(FIRST_CHARGE, "lost"));
  assertEquals([lost.balance(FRIEND_CUSTOMER), lost.balance(INVITER_CUSTOMER)], [0, 0]);
  assertEquals(lost.stripe.txns.length, 4);
});

Deno.test("a reversal made but not recorded, then a won dispute: found first, so nothing is taken twice", async () => {
  const w = world(paid());
  await w.run();
  w.db.failRecord = 2 * ALL_RECORD_TRIES; // Both reversals are made, neither recorded.
  assertEquals(await w.run(disputed(FIRST_CHARGE)), 500);
  w.stripe.now += 2 * DAY_MS;
  assertEquals(await w.run(disputeClosed(FIRST_CHARGE, "won")), 200);
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [-FRIEND_CENTS, -INVITER_CENTS]);
  // Then refunded after all: a second round, with its own keys, taken back exactly once.
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
  assertEquals(w.stripe.txns.slice(6).map((t) => t.key), [keyOf("friend", "reversal", 2), keyOf("referrer", "reversal", 2)]);
});

Deno.test("a new round waits until the give-back is recorded", async () => {
  const w = world(paid());
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  w.db.failRecord = 2 * ALL_RECORD_TRIES; // Give-backs made, not recorded.
  assertEquals(await w.run(disputeClosed(FIRST_CHARGE, "won")), 500);
  w.stripe.now += 2 * DAY_MS;
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals(w.row.round, 2);
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
  assertEquals(w.stripe.txns.length, 8);
});

Deno.test("a dispute won on a charge that was refunded gives nothing back", async () => {
  const w = world(paid());
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  assertEquals(w.stripe.txns.length, 4);
});
