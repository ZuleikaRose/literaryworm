// Deploy with JWT verification off (Stripe doesn't send a Supabase token); every request's
// Stripe signature is checked instead. See handler.ts.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { paymentFailedEmail } from "./email.ts";
import { giftCode, releaseSchedule, stripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { handle, type NewGift, type ReferralTransaction, type SubscriptionFields } from "./handler.ts";

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
    .filter((r) => r.customer && r.cents && r.cents > 0 && (r.side === "friend" || r.side === "referrer") && ["credit", "reversal", "recredit"].includes(r.kind))
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

/** Taking back or giving again; nothing while the database is older than migration 6843. */
async function referralRpc(fn: "reverse_referral_reward" | "restore_referral_reward", referredId: string, invoiceId: string): Promise<ReferralTransaction[]> {
  const { data, error } = await serviceClient().rpc(fn, { p_referred: referredId, p_invoice: invoiceId });
  if (error?.code === "PGRST202") {
    console.warn(`stripe-webhook: ${fn} isn't there yet (migration 6843)`);
    return [];
  }
  if (error) throw error;
  return pendingRows(data);
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
    async claimReferral(referredId, invoiceId) {
      const db = serviceClient();
      const res = await db.rpc("claim_referral_reward", { p_referred: referredId, p_invoice: invoiceId });
      if (!res.error) return { pending: pendingRows(res.data) };
      // Before migration 6843 the function took only the account: the old free month, the old way.
      if (res.error.code !== "PGRST202") throw res.error;
      const old = await db.rpc("claim_referral_reward", { p_referred: referredId });
      if (old.error) throw old.error;
      const row = (old.data ?? [])[0] as
        | { referral_id: string; friend_customer: string | null; friend_cents: number | null; referrer_customer: string | null; referrer_cents: number | null }
        | undefined;
      if (!row?.friend_customer || !row.friend_cents) return { pending: [], legacy: null };
      return {
        pending: [],
        legacy: {
          referralId: row.referral_id,
          friendCustomer: row.friend_customer,
          friendCents: row.friend_cents,
          referrerCustomer: row.referrer_customer,
          referrerCents: row.referrer_cents,
        },
      };
    },
    async reverseReferral(referredId, invoiceId) {
      return referralRpc("reverse_referral_reward", referredId, invoiceId);
    },
    async restoreReferral(referredId, invoiceId) {
      return referralRpc("restore_referral_reward", referredId, invoiceId);
    },
    async findBalanceTransaction(customerId, key) {
      // Newest first; a referral's transactions are recent, so the latest few hundred are enough.
      let seen = 0;
      for await (const txn of stripeClient().customers.listBalanceTransactions(customerId, { limit: 100 })) {
        if (txn.metadata?.[KEY_METADATA] === key) return txn.id;
        if (++seen >= BALANCE_LOOKBACK) break;
      }
      return null;
    },
    async adjustBalance(customerId, amountCents, currency, key, description) {
      const txn = await stripeClient().customers.createBalanceTransaction(
        customerId,
        { amount: amountCents, currency, description, metadata: { [KEY_METADATA]: key } },
        { idempotencyKey: key },
      );
      return txn.id;
    },
    async recordReferralTransaction(txn, transactionId) {
      const { error } = await serviceClient().rpc("record_referral_transaction", {
        p_referral: txn.referralId,
        p_side: txn.side,
        p_kind: txn.kind,
        p_round: txn.round,
        p_txn: transactionId,
      });
      if (error) throw error;
    },
    async chargeDetails(chargeId) {
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
    },
    async creditCustomer(customerId, cents, idempotencyKey, description) {
      // A negative balance is a credit: Stripe takes it off the customer's next invoices.
      const txn = await stripeClient().customers.createBalanceTransaction(
        customerId,
        { amount: -cents, currency: "usd", description },
        { idempotencyKey },
      );
      return txn.id;
    },
    async recordReferralCredits(referralId, friendCredit, referrerCredit) {
      const { error } = await serviceClient().rpc("record_referral_credits", { p_referral: referralId, p_friend: friendCredit, p_referrer: referrerCredit });
      if (error) throw error;
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
    async releaseReferral(referralId) {
      const { error } = await serviceClient().rpc("release_referral_reward", { p_referral: referralId });
      if (error) console.error(`stripe-webhook: couldn't hand back referral ${referralId}`, error.message);
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
