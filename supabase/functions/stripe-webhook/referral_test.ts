// deno test --allow-env supabase/functions/stripe-webhook — refer a friend in stripe-webhook, offline.
// The database is a small model of migration 6843 (claim, take back, give again, record, what's still
// owed), and Stripe a model of customer balances with idempotency keys that expire after a day.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import type { Stripe } from "../_shared/stripe.ts";
import { type Deps, handle, type ReferralReward, type ReferralRule, type ReferralTransaction, referralKey } from "./handler.ts";

const FRIEND = "00000000-0000-0000-0000-0000000000f1";
const FRIEND_CUSTOMER = "cus_friend";
const INVITER_CUSTOMER = "cus_inviter";
const REFERRAL = "ref_1";
const FIRST_INVOICE = "in_first";
const LATER_INVOICE = "in_second";
const FIRST_CHARGE = "ch_first";
const LATER_CHARGE = "ch_second";
// 20% of one month: Basic monthly ($30.00) for the friend, Premium yearly ($600.00 / 12) for the inviter.
const FRIEND_CENTS = 600;
const INVITER_CENTS = 1000;
const FREE_MONTH_FRIEND_CENTS = 3000;
const FREE_MONTH_INVITER_CENTS = 6000;
const PLAN_PRICE_CENTS = 3000;
const DAY_MS = 86_400_000;
const IDEMPOTENCY_KEY_LIFETIME_MS = DAY_MS;

type Side = "friend" | "referrer";
type Kind = ReferralTransaction["kind"];

interface SideRow {
  cents: number | null;
  currency: string;
  customer: string;
  credit: string | null;
  reversal: string | null;
  recredit: string | null;
}

/** One referral row, as migration 6843 keeps it. */
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
  key: string;
  description: string;
}

interface Options {
  rule?: ReferralRule;
  inviterCents?: number | null;
  inviterCurrency?: string;
  legacy?: ReferralReward | null;
}

function world(ev: Stripe.Event, options: Options = {}) {
  const rule = options.rule ?? "percent_20";
  const row: Row = {
    rule,
    decided: false,
    firstInvoice: null,
    reversed: false,
    round: 0,
    sides: {
      friend: { cents: rule === "free_month" ? FREE_MONTH_FRIEND_CENTS : FRIEND_CENTS, currency: "usd", customer: FRIEND_CUSTOMER, credit: null, reversal: null, recredit: null },
      referrer: {
        cents: options.inviterCents === undefined ? (rule === "free_month" ? FREE_MONTH_INVITER_CENTS : INVITER_CENTS) : options.inviterCents,
        currency: options.inviterCurrency ?? "usd",
        customer: INVITER_CUSTOMER,
        credit: null,
        reversal: null,
        recredit: null,
      },
    },
  };
  const stripe = {
    now: 0,
    txns: [] as Txn[],
    /** key → when it was first used and what it made. */
    keys: new Map<string, { at: number; id: string }>(),
    fail: new Set<string>(),
    /** Whether looking up a transaction by its metadata key works (off: only idempotency keys protect). */
    search: true,
    charges: new Map<string, { customer: string; refunded: boolean; invoiceId: string | null }>([
      [FIRST_CHARGE, { customer: FRIEND_CUSTOMER, refunded: false, invoiceId: FIRST_INVOICE }],
      [LATER_CHARGE, { customer: FRIEND_CUSTOMER, refunded: false, invoiceId: LATER_INVOICE }],
    ]),
  };
  const db = { failRecord: 0, legacy: options.legacy ?? null, legacyRecorded: [] as unknown[], released: [] as string[] };

  const pending = (kinds: Kind[]): ReferralTransaction[] => {
    if (!row.decided) return [];
    const out: ReferralTransaction[] = [];
    for (const side of ["friend", "referrer"] as Side[]) {
      const s = row.sides[side];
      if (s.cents === null) continue;
      let kind: Kind | null = null;
      if (!row.reversed && !s.credit) kind = "credit";
      else if (row.rule === "percent_20" && row.reversed && s.credit && !s.reversal) kind = "reversal";
      else if (row.rule === "percent_20" && !row.reversed && row.round > 0 && s.reversal && !s.recredit) kind = "recredit";
      if (kind && kinds.includes(kind)) {
        out.push({ referralId: REFERRAL, side, kind, round: row.round, customer: s.customer, cents: s.cents, currency: s.currency, rule: row.rule });
      }
    }
    return out;
  };

  const balance = (customer: string) => stripe.txns.filter((t) => t.customer === customer).reduce((sum, t) => sum + t.amount, 0);

  const deps: Deps = {
    verify: (_body, signature) => (signature === "good" ? Promise.resolve(ev) : Promise.reject(new Error("bad"))),
    alreadyHandled: () => Promise.resolve(false),
    markHandled: () => Promise.resolve(),
    userForCustomer: (c) => Promise.resolve(c === FRIEND_CUSTOMER ? FRIEND : null),
    isStaff: () => Promise.resolve(false),
    recordCardPayment: () => Promise.resolve(),
    getSubscription: () => Promise.reject(new Error("not used")),
    startMembership: () => Promise.resolve(),
    updateMembership: () => Promise.resolve(true),
    cancelNow: () => Promise.resolve(),
    createGift: () => Promise.resolve(),
    deleteDraftInvoice: () => Promise.resolve(),
    claimReferral: (_userId, invoiceId) => {
      if (db.legacy) {
        const legacy = db.legacy;
        db.legacy = null;
        return Promise.resolve({ pending: [], legacy });
      }
      if (!row.decided) {
        row.decided = true;
        row.firstInvoice = invoiceId;
      }
      return Promise.resolve({ pending: pending(["credit", "recredit"]) });
    },
    reverseReferral: (_userId, invoiceId) => {
      if (row.rule !== "percent_20" || !row.decided || row.firstInvoice !== invoiceId) return Promise.resolve([]);
      if (!row.reversed) {
        row.reversed = true;
        row.round += 1;
        row.sides.friend.reversal = null;
        row.sides.referrer.reversal = null;
      }
      return Promise.resolve(pending(["reversal"]));
    },
    restoreReferral: (_userId, invoiceId) => {
      if (row.rule !== "percent_20" || row.firstInvoice !== invoiceId) return Promise.resolve([]);
      if (row.reversed) {
        row.reversed = false;
        row.sides.friend.recredit = null;
        row.sides.referrer.recredit = null;
      }
      return Promise.resolve(pending(["credit", "recredit"]));
    },
    findBalanceTransaction: (customer, key) => Promise.resolve(stripe.search ? (stripe.txns.find((t) => t.customer === customer && t.key === key)?.id ?? null) : null),
    adjustBalance: (customer, amount, currency, key, description) => {
      if (stripe.fail.has(key)) return Promise.reject(new Error("stripe down"));
      const used = stripe.keys.get(key);
      if (used && stripe.now - used.at < IDEMPOTENCY_KEY_LIFETIME_MS) return Promise.resolve(used.id);
      const id = `cbtxn_${stripe.txns.length + 1}`;
      stripe.txns.push({ id, customer, amount, currency, key, description });
      stripe.keys.set(key, { at: stripe.now, id });
      return Promise.resolve(id);
    },
    recordReferralTransaction: (txn, id) => {
      if (db.failRecord > 0) {
        db.failRecord -= 1;
        return Promise.reject(new Error("db down"));
      }
      const s = row.sides[txn.side];
      if (txn.kind === "credit") s.credit ??= id;
      else if (txn.round === row.round && txn.kind === "reversal") s.reversal ??= id;
      else if (txn.round === row.round) s.recredit ??= id;
      return Promise.resolve();
    },
    chargeDetails: (chargeId) => Promise.resolve(stripe.charges.get(chargeId) ?? { customer: null, refunded: false, invoiceId: null }),
    creditCustomer: (customer, cents, key, description) => deps.adjustBalance(customer, -cents, "usd", key, description),
    recordReferralCredits: (...args) => {
      db.legacyRecorded.push(args);
      return Promise.resolve();
    },
    releaseReferral: (id) => {
      db.released.push(id);
      return Promise.resolve();
    },
    claimAffiliate: () => Promise.resolve(null),
    recordAffiliateCredit: () => Promise.resolve(),
    releaseAffiliate: () => Promise.resolve(),
    notifyPaymentFailed: () => Promise.resolve(),
    addVoicePack: () => Promise.resolve(),
  };
  const run = async (next?: Stripe.Event) => {
    if (next) ev = next;
    return (await handle(new Request("http://x", { method: "POST", headers: { "Stripe-Signature": "good" }, body: "{}" }), deps)).status;
  };
  return { row, stripe, db, deps, run, balance };
}

const event = (type: string, object: Record<string, unknown>): Stripe.Event => ({ id: `evt_${type}`, type, livemode: false, data: { object } }) as unknown as Stripe.Event;
const paid = (invoice = FIRST_INVOICE, amount_paid = PLAN_PRICE_CENTS) =>
  event("invoice.paid", { id: invoice, customer: FRIEND_CUSTOMER, amount_paid, parent: { subscription_details: { subscription: "sub_1" } } });
const refunded = (charge: string, full: boolean) => event("charge.refunded", { id: charge, refunded: full });
const disputed = (charge: string) => event("charge.dispute.created", { id: "dp_1", charge });
const disputeClosed = (charge: string, status: string) => event("charge.dispute.closed", { id: "dp_1", charge, status });

// The subscription the invoice belongs to is fetched; this model's is always the friend's.
function withSubscription(w: ReturnType<typeof world>) {
  w.deps.getSubscription = () =>
    Promise.resolve({
      id: "sub_1",
      customer: FRIEND_CUSTOMER,
      status: "active",
      pause_collection: null,
      cancel_at_period_end: false,
      billing_cycle_anchor: 1_797_552_000,
      items: { data: [{ price: { lookup_key: "literaryworm_basic_monthly" }, current_period_end: 1_798_761_600 }] },
    } as unknown as Stripe.Subscription);
  return w;
}

const keyOf = (side: Side, kind: Kind = "credit", round = 0, rule: ReferralRule = "percent_20") => referralKey({ referralId: REFERRAL, side, kind, round, rule });

// Credits ---------------------------------------------------------------------------------------------

Deno.test("the friend's first payment credits 20% of a month to each side, in each side's own currency", async () => {
  const w = withSubscription(world(paid(), { inviterCurrency: "eur" }));
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
  const w = withSubscription(world(paid(), { inviterCents: null }));
  await w.run();
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend")]);
});

Deno.test("a free month earned before the change is credited as a free month, with its old keys", async () => {
  const w = withSubscription(world(paid(), { rule: "free_month" }));
  await w.run();
  assertEquals(
    w.stripe.txns.map((t) => [t.amount, t.key, t.description]),
    [
      [-FREE_MONTH_FRIEND_CENTS, "referral-ref_1-friend", "A month free: you joined with a friend's invitation"],
      [-FREE_MONTH_INVITER_CENTS, "referral-ref_1-referrer", "A month free: a friend you invited joined"],
    ],
  );
});

Deno.test("nothing charged rewards nothing yet", async () => {
  const w = withSubscription(world(paid(FIRST_INVOICE, 0)));
  await w.run();
  assertEquals(w.stripe.txns, []);
  assertEquals(w.row.decided, false);
});

// Retries ---------------------------------------------------------------------------------------------

Deno.test("friend credited, inviter fails: the friend's credit is kept and the retry makes only the inviter's", async () => {
  const w = withSubscription(world(paid()));
  w.stripe.fail.add(keyOf("referrer"));
  assertEquals(await w.run(), 500);
  assertEquals(w.row.sides.friend.credit, "cbtxn_1");
  assertEquals(w.row.sides.referrer.credit, null);
  w.stripe.fail.clear();
  assertEquals(await w.run(), 200);
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend"), keyOf("referrer")]);
});

Deno.test("a retry more than a day later, after the record failed, finds the credit at Stripe instead of making another", async () => {
  const w = withSubscription(world(paid()));
  const ALL_RECORD_TRIES_FAIL = 6;
  w.db.failRecord = ALL_RECORD_TRIES_FAIL;
  assertEquals(await w.run(), 500);
  assertEquals(w.stripe.txns.length, 2);
  w.stripe.now += 2 * DAY_MS; // The idempotency keys have expired.
  assertEquals(await w.run(), 200);
  assertEquals(w.stripe.txns.length, 2);
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", "cbtxn_2"]);
});

Deno.test("a record that fails once is tried again at once, so the credit isn't lost", async () => {
  const w = withSubscription(world(paid()));
  w.db.failRecord = 1;
  assertEquals(await w.run(), 200);
  assertEquals([w.row.sides.friend.credit, w.row.sides.referrer.credit], ["cbtxn_1", "cbtxn_2"]);
});

Deno.test("every later paid invoice credits nothing more", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  w.stripe.now += 31 * DAY_MS;
  await w.run(paid(LATER_INVOICE));
  w.stripe.search = false; // Even without the lookup: the database says nothing is owed.
  await w.run(paid(LATER_INVOICE));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("with the old database (before 6843) it works the old way, and hands a failure back", async () => {
  const legacy: ReferralReward = { referralId: REFERRAL, friendCustomer: FRIEND_CUSTOMER, friendCents: 3000, referrerCustomer: INVITER_CUSTOMER, referrerCents: 4000 };
  const ok = withSubscription(world(paid(), { legacy }));
  await ok.run();
  assertEquals(ok.stripe.txns.map((t) => [t.amount, t.key]), [[-3000, "referral-ref_1-friend"], [-4000, "referral-ref_1-referrer"]]);
  assertEquals(ok.db.legacyRecorded, [[REFERRAL, "cbtxn_1", "cbtxn_2"]]);
  const failing = withSubscription(world(paid(), { legacy }));
  failing.stripe.fail.add("referral-ref_1-referrer");
  assertEquals(await failing.run(), 500);
  assertEquals(failing.db.released, [REFERRAL]);
});

// Taking back -----------------------------------------------------------------------------------------

Deno.test("a full refund of the first payment takes both credits back, once", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  assertEquals(await w.run(refunded(FIRST_CHARGE, true)), 200);
  await w.run(refunded(FIRST_CHARGE, true)); // Stripe sends it again.
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
  const w = withSubscription(world(paid()));
  await w.run();
  await w.run(refunded(FIRST_CHARGE, false));
  assertEquals(w.stripe.txns.length, 2);
  assertEquals(w.row.reversed, false);
});

Deno.test("a refund of a later payment takes nothing back", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  w.stripe.charges.get(LATER_CHARGE)!.refunded = true;
  await w.run(refunded(LATER_CHARGE, true));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("a refund after the credit was used still takes it back: it's owed on the next bill", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  // The next invoice used the friend's credit: Stripe took it off, leaving the balance at 0.
  w.stripe.txns.push({ id: "cbtxn_used", customer: FRIEND_CUSTOMER, amount: FRIEND_CENTS, currency: "usd", key: "invoice", description: "applied" });
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals(w.balance(FRIEND_CUSTOMER), FRIEND_CENTS);
});

Deno.test("a free month is never taken back", async () => {
  const w = withSubscription(world(paid(), { rule: "free_month" }));
  await w.run();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  await w.run(disputed(FIRST_CHARGE));
  assertEquals(w.stripe.txns.length, 2);
});

Deno.test("a refund before the inviter's credit was made: the friend's is taken back and the inviter's is never made", async () => {
  const w = withSubscription(world(paid()));
  w.stripe.fail.add(keyOf("referrer"));
  await w.run();
  w.stripe.fail.clear();
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  await w.run(paid(LATER_INVOICE));
  assertEquals(w.stripe.txns.map((t) => t.key), [keyOf("friend"), keyOf("friend", "reversal", 1)]);
});

Deno.test("a reversal that fails for one side is retried for that side only", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  w.stripe.fail.add(keyOf("referrer", "reversal", 1));
  assertEquals(await w.run(disputed(FIRST_CHARGE)), 500);
  w.stripe.fail.clear();
  assertEquals(await w.run(disputed(FIRST_CHARGE)), 200);
  assertEquals(w.stripe.txns.slice(2).map((t) => t.key), [keyOf("friend", "reversal", 1), keyOf("referrer", "reversal", 1)]);
});

Deno.test("a dispute takes both back; won, they're added again; a lost one changes nothing more", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  await w.run(disputeClosed(FIRST_CHARGE, "won")); // Stripe sends it again.
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [-FRIEND_CENTS, -INVITER_CENTS]);
  assertEquals(w.stripe.txns.slice(4).map((t) => [t.key, t.description]), [
    [keyOf("friend", "recredit", 1), "20% referral credit added again: the dispute was closed in our favour"],
    [keyOf("referrer", "recredit", 1), "20% referral credit added again: the dispute was closed in our favour"],
  ]);

  const lost = withSubscription(world(paid()));
  await lost.run();
  await lost.run(disputed(FIRST_CHARGE));
  await lost.run(disputeClosed(FIRST_CHARGE, "lost"));
  assertEquals([lost.balance(FRIEND_CUSTOMER), lost.balance(INVITER_CUSTOMER)], [0, 0]);
  assertEquals(lost.stripe.txns.length, 4);
});

Deno.test("a dispute won on a charge that was refunded gives nothing back", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  assertEquals(w.stripe.txns.length, 4);
});

Deno.test("a second round (won, then refunded) has its own keys", async () => {
  const w = withSubscription(world(paid()));
  await w.run();
  await w.run(disputed(FIRST_CHARGE));
  await w.run(disputeClosed(FIRST_CHARGE, "won"));
  w.stripe.charges.get(FIRST_CHARGE)!.refunded = true;
  await w.run(refunded(FIRST_CHARGE, true));
  assertEquals(w.stripe.txns.slice(6).map((t) => t.key), [keyOf("friend", "reversal", 2), keyOf("referrer", "reversal", 2)]);
  assertEquals([w.balance(FRIEND_CUSTOMER), w.balance(INVITER_CUSTOMER)], [0, 0]);
});
