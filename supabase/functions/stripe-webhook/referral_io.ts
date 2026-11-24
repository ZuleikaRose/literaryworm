// Refer a friend's database and Stripe calls for stripe-webhook (index.ts spreads them into its deps).
// Kept apart, with their clients passed in, so referral_io_test.ts runs these very paths with stubs.
import { type Deps, PermanentFailure, type ReferralTransaction, SetAside } from "./handler.ts";

/** The metadata key that carries a transaction's own key, so a retry can find it at Stripe. */
export const KEY_METADATA = "literaryworm_key";
/** How many of a customer's latest balance transactions are searched for one already made. */
export const BALANCE_LOOKBACK = 500;
/** How long to wait before asking once more when PostgREST doesn't know a function yet (its schema cache). */
export const SCHEMA_RETRY_MS = 1500;

interface DbError {
  code?: string;
  message?: string;
}
interface DbResult {
  data: unknown;
  error: DbError | null;
}
/** The part of the Supabase client used here. */
export interface ReferralDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
}
interface BalanceTxn {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  metadata?: Record<string, string> | null;
}
/** The part of the Stripe client used here. */
export interface ReferralStripe {
  customers: {
    listBalanceTransactions(customer: string, params: { limit: number }): AsyncIterable<BalanceTxn>;
    createBalanceTransaction(
      customer: string,
      params: { amount: number; currency: string; description: string; metadata: Record<string, string> },
      options: { idempotencyKey: string },
    ): Promise<{ id: string }>;
  };
  charges: {
    retrieve(id: string): Promise<{ customer: string | { id: string } | null; payment_intent: string | { id: string } | null; refunded: boolean }>;
  };
  disputes: {
    list(params: { charge: string; limit: number }): Promise<{ data: { status: string; created: number }[] }>;
  };
  invoicePayments: {
    list(params: { payment: { type: "payment_intent"; payment_intent: string }; limit: number }): Promise<{ data: { invoice: string | { id: string } | null }[] }>;
  };
}
export interface ReferralIo {
  db: () => ReferralDb;
  stripe: () => ReferralStripe;
  sleep: (ms: number) => Promise<void>;
}

/** Columns stripe_events has only once migrations 165931 and 174720 are in. */
export const REVIEW_COLUMNS = ["review_reason", "review_referral", "review_referred_user", "review_payload"];

/** Whether recording an event failed only because the review columns aren't there yet (before the migrations). */
export function reviewColumnsMissing(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === "PGRST204" || error.code === "42703") && REVIEW_COLUMNS.some((c) => error.message?.includes(c) ?? false);
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/** Rows from private.referral_pending(), checked. */
export function pendingRows(data: unknown): ReferralTransaction[] {
  const rows = (Array.isArray(data) ? data : []) as {
    referral_id: string;
    side: string;
    kind: string;
    round: number;
    customer: string | null;
    cents: number | null;
    currency: string | null;
    reward_rule: string | null;
    created_at?: string | null;
  }[];
  return rows
    .filter((r) => r.customer && r.cents && r.cents > 0 && (r.side === "friend" || r.side === "referrer") && ["credit", "credit_check", "reversal", "recredit"].includes(r.kind))
    .map((r) => ({
      referralId: r.referral_id,
      side: r.side as ReferralTransaction["side"],
      kind: r.kind as ReferralTransaction["kind"],
      round: r.round ?? 0,
      customer: r.customer!,
      cents: r.cents!,
      currency: /^[a-z]{3}$/.test(r.currency ?? "") ? r.currency! : "usd",
      rule: r.reward_rule === "free_month" ? "free_month" : "percent_20",
      createdAt: r.created_at ?? null,
    }));
}

/**
 * Stripe's answer, sorted: our key refused (401/403) sets the event aside for review; any other 4xx but 409
 * (idempotency key in use) and 429 (rate limit) is permanent (counted towards setting the side aside);
 * everything else (5xx, network, 409, 429) is temporary and thrown as it is, so Stripe retries the event.
 */
export async function stripeCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    const e = err as { type?: string; statusCode?: number; message?: string };
    if (e?.type === "StripePermissionError" || e?.type === "StripeAuthenticationError" || e?.statusCode === 401 || e?.statusCode === 403) {
      throw new SetAside(`Stripe refused the key: ${e.message}`);
    }
    const status = e?.statusCode;
    if (typeof status === "number" && status >= 400 && status < 500 && status !== 409 && status !== 429) {
      throw new PermanentFailure(`Stripe ${status}: ${e.message}`);
    }
    throw err;
  }
}

export function referralDeps(io: ReferralIo) {
  /**
   * Calls a referral database function. PostgREST answers PGRST202 when it doesn't know the function (not
   * migrated yet, or its schema cache is behind): asked once more after a moment, then set aside for
   * review. Never retried with fewer arguments, which could reach another version of the function.
   */
  async function referralRpc(fn: string, args: Record<string, unknown>): Promise<ReferralTransaction[]> {
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await io.db().rpc(fn, args);
      if (!error) return pendingRows(data);
      if (error.code !== "PGRST202") throw error;
      if (attempt >= 1) throw new SetAside(`${fn} isn't in the database's API yet (migrations 6843 and 160955)`);
      await io.sleep(SCHEMA_RETRY_MS);
    }
  }

  async function known(txnId: string): Promise<boolean> {
    const { data, error } = await io.db().rpc("referral_transaction_known", { p_txn: txnId });
    if (error) throw error;
    return data === true;
  }

  const deps: Pick<
    Deps,
    | "claimReferral"
    | "referralOwed"
    | "reverseReferral"
    | "restoreReferral"
    | "takeBackPossible"
    | "findBalanceTransaction"
    | "adjustBalance"
    | "recordReferralTransaction"
    | "recordReferralCheck"
    | "noteReferralFailure"
    | "chargeDetails"
    | "creditCustomer"
  > = {
    claimReferral: (referredId, invoiceId) => referralRpc("claim_referral_reward", { p_referred: referredId, p_invoice: invoiceId }),
    referralOwed: (referralId) => referralRpc("referral_owed", { p_referral: referralId }),
    reverseReferral: (referredId, invoiceId) => referralRpc("reverse_referral_reward", { p_referred: referredId, p_invoice: invoiceId }),
    restoreReferral: (referredId, invoiceId) => referralRpc("restore_referral_reward", { p_referred: referredId, p_invoice: invoiceId }),
    async takeBackPossible(customerId) {
      const { data, error } = await io.db().rpc("referral_takeback_possible", { p_customer: customerId });
      // Not migrated yet: there's nothing a refund could take back.
      if (error?.code === "PGRST202") return false;
      if (error) throw error;
      return data === true;
    },
    findBalanceTransaction(customerId, key, unmarked) {
      return stripeCall(async () => {
        // Newest first; a referral's transactions are recent, so the latest few hundred are enough.
        let seen = 0;
        const candidates: BalanceTxn[] = [];
        for await (const txn of io.stripe().customers.listBalanceTransactions(customerId, { limit: 100 })) {
          if (txn.metadata?.[KEY_METADATA] === key) return txn.id;
          // An old free month made without a key: same description and currency, made after the referral.
          if (
            unmarked &&
            !txn.metadata?.[KEY_METADATA] &&
            txn.description === unmarked.description &&
            txn.currency === unmarked.currency &&
            (unmarked.amountCents === undefined || txn.amount === unmarked.amountCents) &&
            (!unmarked.since || txn.created * 1000 >= Date.parse(unmarked.since))
          ) {
            candidates.push(txn);
          }
          if (++seen >= BALANCE_LOOKBACK) break;
        }
        // Oldest first, and never one already recorded on any referral.
        for (const txn of candidates.reverse()) {
          if (!(await known(txn.id))) return txn.id;
        }
        return null;
      });
    },
    adjustBalance(customerId, amountCents, currency, key, description) {
      return stripeCall(async () => {
        const txn = await io.stripe().customers.createBalanceTransaction(
          customerId,
          { amount: amountCents, currency, description, metadata: { [KEY_METADATA]: key } },
          { idempotencyKey: key },
        );
        return txn.id;
      });
    },
    async recordReferralTransaction(txn, transactionId) {
      const { error } = await io.db().rpc("record_referral_transaction", {
        p_referral: txn.referralId,
        p_side: txn.side,
        p_kind: txn.kind === "credit_check" ? "credit" : txn.kind,
        p_round: txn.round,
        p_txn: transactionId,
      });
      // A transaction already recorded elsewhere won't fix itself: permanent. Anything else is temporary.
      if (error?.message?.includes("referral_txn_reused")) throw new PermanentFailure(error.message);
      if (error) throw error;
    },
    async recordReferralCheck(txn) {
      const { error } = await io.db().rpc("record_referral_check", { p_referral: txn.referralId, p_side: txn.side, p_round: txn.round });
      if (error) throw error;
    },
    async noteReferralFailure(txn, message) {
      const { data, error } = await io.db().rpc("note_referral_failure", { p_referral: txn.referralId, p_side: txn.side, p_error: message });
      if (error) throw error;
      return data === true;
    },
    chargeDetails(chargeId) {
      return stripeCall(async () => {
        const stripe = io.stripe();
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentIntent = idOf(charge.payment_intent);
        let invoiceId: string | null = null;
        if (paymentIntent) {
          const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 1 });
          invoiceId = idOf(payments.data[0]?.invoice);
        }
        // The latest dispute on the charge, if any (Stripe lists them newest first).
        const disputes = await stripe.disputes.list({ charge: chargeId, limit: 1 });
        return { customer: idOf(charge.customer), refunded: charge.refunded, invoiceId, disputeStatus: disputes.data[0]?.status ?? null };
      });
    },
    creditCustomer(customerId, cents, idempotencyKey, description) {
      // A negative balance is a credit: Stripe takes it off the customer's next invoices.
      return stripeCall(async () => {
        const txn = await io.stripe().customers.createBalanceTransaction(
          customerId,
          { amount: -cents, currency: "usd", description, metadata: { [KEY_METADATA]: idempotencyKey } },
          { idempotencyKey },
        );
        return txn.id;
      });
    },
  };
  return deps;
}
