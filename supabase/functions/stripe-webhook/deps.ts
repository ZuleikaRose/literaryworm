// stripe-webhook's database, Stripe and email calls. index.ts serves them to Stripe; referral-retry uses
// them to replay an event set aside for review (the same code, so a replay does what the event would have).
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { paymentFailedEmail } from "./email.ts";
import { giftCode, releaseSchedule, stripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { type Deps, type NewGift, type SubscriptionFields } from "./handler.ts";
import { referralDeps, type ReferralIo, reviewColumnsMissing } from "./referral_io.ts";

const referralIo: ReferralIo = {
  db: () => serviceClient(),
  stripe: () => stripeClient() as unknown as ReturnType<ReferralIo["stripe"]>,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const MEMBERSHIP_COLUMNS = "user_id";

export const webhookDeps = (): Deps => ({
  verify: verifyWebhook,
  async alreadyHandled(eventId) {
    const { data, error } = await serviceClient().from("stripe_events").select("id").eq("id", eventId).maybeSingle();
    if (error) throw error;
    return data !== null;
  },
  async markHandled(event, needsReview, note) {
    const object = event.data.object as { id?: string };
    const { error } = await serviceClient().from("stripe_events").upsert(
      {
        id: event.id,
        type: event.type,
        object_id: object.id ?? null,
        livemode: event.livemode,
        needs_review: needsReview,
        // A set-aside event is kept whole, so the team can replay it (referral-retry).
        ...(note ? { review_reason: note.reason, review_referral: note.referralId, review_referred_user: note.referredUserId, review_payload: event } : {}),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    // Before the migrations add the review columns (PGRST204, or 42703 from Postgres), the event is
    // still recorded for review, without the note.
    if (note && reviewColumnsMissing(error)) {
      const plain = await serviceClient().from("stripe_events").upsert(
        { id: event.id, type: event.type, object_id: object.id ?? null, livemode: event.livemode, needs_review: needsReview },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (plain.error) throw plain.error;
      return;
    }
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
  ...referralDeps(referralIo),
  async claimAffiliate(referredId, amountCents) {
    const { data, error } = await serviceClient().rpc("claim_affiliate_commission", { p_referred: referredId, p_amount_cents: amountCents });
    if (error) throw error;
    const row = (data ?? [])[0] as { referral_id: string; affiliate_customer: string | null; commission_cents: number | null } | undefined;
    if (!row?.affiliate_customer || !row.commission_cents) return null;
    return { referralId: row.referral_id, affiliateCustomer: row.affiliate_customer, cents: row.commission_cents };
  },
  async affiliateReferralSince(referralId) {
    const { data, error } = await serviceClient().from("affiliate_referrals").select("created_at").eq("id", referralId).maybeSingle();
    if (error) throw error;
    return (data?.created_at as string | undefined) ?? null;
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
});
