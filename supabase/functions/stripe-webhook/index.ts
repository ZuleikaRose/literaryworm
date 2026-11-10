// Deploy with JWT verification off (Stripe doesn't send a Supabase token); every request's
// Stripe signature is checked instead. See handler.ts.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { paymentFailedEmail } from "./email.ts";
import { giftCode, releaseSchedule, stripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { handle, type NewGift, type SubscriptionFields } from "./handler.ts";

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
    async claimReferral(referredId) {
      const { data, error } = await serviceClient().rpc("claim_referral_reward", { p_referred: referredId });
      if (error) throw error;
      const row = (data ?? [])[0] as
        | { referral_id: string; friend_customer: string | null; friend_cents: number | null; referrer_customer: string | null; referrer_cents: number | null }
        | undefined;
      if (!row?.friend_customer || !row.friend_cents) return null;
      return {
        referralId: row.referral_id,
        friendCustomer: row.friend_customer,
        friendCents: row.friend_cents,
        referrerCustomer: row.referrer_customer,
        referrerCents: row.referrer_cents,
      };
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
