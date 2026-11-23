// Deploy with JWT verification off (Stripe doesn't send a Supabase token); every request's
// Stripe signature is checked instead. See handler.ts.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { paymentFailedEmail } from "./email.ts";
import { giftCode, releaseSchedule, stripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { handle, type NewGift, type ReferralTransaction, SetAside, type SubscriptionFields } from "./handler.ts";

/** The metadata key that carries a referral transaction's own key, so a retry can find it at Stripe. */
const KEY_METADATA = "literaryworm_key";
/** How many of a customer's latest balance transactions are searched for one already made. */
const BALANCE_LOOKBACK = 500;

/** Rows from private.referral_pending(), checked. */
function pendingRows(data: unknown): ReferralTransaction[] {
  const rows = (Array.isArray(data) ? data : []) as {
    referral_id: string;
    side: string;
    kind: string;
    round: number;
    customer: string | null;
    cents: number | null;
    currency: string | null;
    reward_rule: string | null;
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
    }));
}

/** How long to wait before asking once more when PostgREST doesn't know a function yet (its schema cache). */
const SCHEMA_RETRY_MS = 1500;

/**
 * Calls a referral database function. PostgREST answers PGRST202 when it doesn't know the function (not
 * migrated yet, or its schema cache is behind): asked once more after a moment, then set aside for
 * review. Never retried with fewer arguments, which could reach another version of the function.
 */
async function referralRpc(fn: string, args: Record<string, unknown>): Promise<ReferralTransaction[]> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await serviceClient().rpc(fn, args);
    if (!error) return pendingRows(data);
    if (error.code !== "PGRST202") throw error;
    if (attempt >= 1) throw new SetAside(`${fn} isn't in the database's API yet (migration 6843)`);
    await new Promise((resolve) => setTimeout(resolve, SCHEMA_RETRY_MS));
  }
}

/** Stripe refusing our key (missing rights, or a bad key) isn't worth three days of retries: set aside. */
async function stripeCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    const e = err as { type?: string; statusCode?: number };
    if (e?.type === "StripePermissionError" || e?.type === "StripeAuthenticationError" || e?.statusCode === 401 || e?.statusCode === 403) {
      throw new SetAside(`Stripe refused the key: ${(err as Error).message}`);
    }
    throw err;
  }
}

const MEMBERSHIP_COLUMNS = "user_id";

Deno.serve((req) =>
  handle(req, {
    verify: verifyWebhook,
    async alreadyHandled(eventId) {
      const { data, error } = await serviceClient().from("stripe_events").select("id").eq("id", eventId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async markHandled(event, needsReview) {
      const object = event.data.object as { id?: string };
      const { error } = await serviceClient().from("stripe_events").upsert(
        { id: event.id, type: event.type, object_id: object.id ?? null, livemode: event.livemode, needs_review: needsReview },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async userForCustomer(customerId) {
      const { data, error } = await serviceClient().from("stripe_customers").select("user_id").eq("customer_id", customerId).maybeSingle();
      if (error) throw error;
      return data?.user_id ?? null;
    },
    // Any staff role: everyone on staff has a complimentary membership.
    async isStaff(userId) {
      const { data, error } = await serviceClient().from("staff_roles").select("role").eq("user_id", userId).limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    async recordCardPayment(userId) {
      const { error } = await serviceClient().rpc("record_card_payment", { p_user_id: userId });
      if (error) throw error;
    },
    getSubscription: (id) => stripeClient().subscriptions.retrieve(id),
    async startMembership(userId, fields: SubscriptionFields, consentAt) {
      const { stripe_customer_id, ...row } = fields;
      const { error } = await serviceClient()
        .from("subscriptions")
        .upsert({ user_id: userId, ...row, stripe_customer_id, renewal_terms_accepted_at: consentAt }, { onConflict: "user_id" });
      if (error) throw error;
    },
    async updateMembership(userId, fields: SubscriptionFields) {
      const { data, error } = await serviceClient().from("subscriptions").update(fields).eq("user_id", userId).select(MEMBERSHIP_COLUMNS);
      if (error) throw error;
      return data.length > 0;
    },
    async cancelNow(subscriptionId) {
      // A scheduled subscription can't be cancelled directly.
      await releaseSchedule(stripeClient(), subscriptionId);
      await stripeClient().subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false });
    },
    async createGift(gift: NewGift) {
      // One code per Checkout Session (its id is unique), so a retried event changes nothing.
      const { error } = await serviceClient().from("gift_codes").upsert(
        {
          code: giftCode(),
          kind: gift.voiceHours ? "voice_hours" : gift.creditCents !== null ? "credit" : "membership",
          plan_id: gift.planId,
          months: gift.months,
          credit_cents: gift.creditCents,
          voice_hours: gift.voiceHours ?? null,
          amount_cents: gift.amountCents,
          currency: gift.currency,
          buyer_id: gift.buyerId,
          stripe_checkout_session_id: gift.sessionId,
          starts_on: gift.startsOn,
          recipient_email: gift.recipientEmail,
          message: gift.message,
          books: gift.books,
        },
        { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async deleteDraftInvoice(invoiceId) {
      await stripeClient().invoices.del(invoiceId);
    },
    claimReferral(referredId, invoiceId) {
      return referralRpc("claim_referral_reward", { p_referred: referredId, p_invoice: invoiceId });
    },
    reverseReferral(referredId, invoiceId) {
      return referralRpc("reverse_referral_reward", { p_referred: referredId, p_invoice: invoiceId });
    },
    restoreReferral(referredId, invoiceId) {
      return referralRpc("restore_referral_reward", { p_referred: referredId, p_invoice: invoiceId });
    },
    async takeBackPossible(customerId) {
      const { data, error } = await serviceClient().rpc("referral_takeback_possible", { p_customer: customerId });
      // Not migrated yet: there's nothing a refund could take back.
      if (error?.code === "PGRST202") return false;
      if (error) throw error;
      return data === true;
    },
    findBalanceTransaction(customerId, key, unmarked) {
      return stripeCall(async () => {
        // Newest first; a referral's transactions are recent, so the latest few hundred are enough.
        let seen = 0;
        let match: string | null = null;
        for await (const txn of stripeClient().customers.listBalanceTransactions(customerId, { limit: 100 })) {
          if (txn.metadata?.[KEY_METADATA] === key) return txn.id;
          if (!match && unmarked && !txn.metadata?.[KEY_METADATA] && txn.amount === unmarked.amountCents && txn.description === unmarked.description) {
            match = txn.id;
          }
          if (++seen >= BALANCE_LOOKBACK) break;
        }
        return match;
      });
    },
    adjustBalance(customerId, amountCents, currency, key, description) {
      return stripeCall(async () => {
        const txn = await stripeClient().customers.createBalanceTransaction(
          customerId,
          { amount: amountCents, currency, description, metadata: { [KEY_METADATA]: key } },
          { idempotencyKey: key },
        );
        return txn.id;
      });
    },
    async recordReferralTransaction(txn, transactionId) {
      const { error } = await serviceClient().rpc("record_referral_transaction", {
        p_referral: txn.referralId,
        p_side: txn.side,
        p_kind: txn.kind === "credit_check" ? "credit" : txn.kind,
        p_round: txn.round,
        p_txn: transactionId,
      });
      if (error) throw error;
    },
    async recordReferralCheck(txn) {
      const { error } = await serviceClient().rpc("record_referral_check", { p_referral: txn.referralId, p_side: txn.side, p_round: txn.round });
      if (error) throw error;
    },
    async noteReferralFailure(txn) {
      const { data, error } = await serviceClient().rpc("note_referral_failure", { p_referral: txn.referralId, p_side: txn.side });
      if (error) throw error;
      return data === true;
    },
    chargeDetails(chargeId) {
      return stripeCall(async () => {
        const stripe = stripeClient();
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        let invoiceId: string | null = null;
        if (paymentIntent) {
          const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 1 });
          const invoice = payments.data[0]?.invoice;
          invoiceId = (typeof invoice === "string" ? invoice : invoice?.id) ?? null;
        }
        const customer = typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;
        return { customer, refunded: charge.refunded, invoiceId };
      });
    },
    async creditCustomer(customerId, cents, idempotencyKey, description) {
      // A negative balance is a credit: Stripe takes it off the customer's next invoices.
      const txn = await stripeClient().customers.createBalanceTransaction(
        customerId,
        { amount: -cents, currency: "usd", description, metadata: { [KEY_METADATA]: idempotencyKey } },
        { idempotencyKey },
      );
      return txn.id;
    },
    async claimAffiliate(referredId, amountCents) {
      const { data, error } = await serviceClient().rpc("claim_affiliate_commission", { p_referred: referredId, p_amount_cents: amountCents });
      if (error) throw error;
      const row = (data ?? [])[0] as { referral_id: string; affiliate_customer: string | null; commission_cents: number | null } | undefined;
      if (!row?.affiliate_customer || !row.commission_cents) return null;
      return { referralId: row.referral_id, affiliateCustomer: row.affiliate_customer, cents: row.commission_cents };
    },
    async recordAffiliateCredit(referralId, creditId) {
      const { error } = await serviceClient().rpc("record_affiliate_credit", { p_referral: referralId, p_credit: creditId });
      if (error) throw error;
    },
    async releaseAffiliate(referralId) {
      const { error } = await serviceClient().rpc("release_affiliate_commission", { p_referral: referralId });
      if (error) console.error(`stripe-webhook: couldn't hand back affiliate commission ${referralId}`, error.message);
    },
    async addVoicePack(pack) {
      const { error } = await serviceClient().rpc("add_natural_voice_pack", {
        p_account: pack.userId,
        p_session: pack.sessionId,
        p_hours: pack.hours,
        p_characters: pack.characters,
        p_amount_cents: pack.amountCents,
      });
      if (error) throw error;
    },
    async notifyPaymentFailed(userId) {
      const db = serviceClient();
      const { data: user, error } = await db.auth.admin.getUserById(userId);
      if (error || !user.user?.email) throw new Error(error?.message ?? "no email address");
      const { data: profile } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const email = paymentFailedEmail({ to: user.user.email, name: (profile?.display_name as string | null) ?? null, site: publicSiteOrigin() });
      await sendWithMailgun({ ...email, tag: "payment-failed" });
    },
  })
);
