// Deploy with JWT verification off (Stripe doesn't send a Supabase token); every request's
// Stripe signature is checked instead. See handler.ts.
import { serviceClient } from "../_shared/supabase.ts";
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
          plan_id: gift.planId,
          months: gift.months,
          amount_cents: gift.amountCents,
          currency: gift.currency,
          buyer_id: gift.buyerId,
          stripe_checkout_session_id: gift.sessionId,
        },
        { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    async deleteDraftInvoice(invoiceId) {
      await stripeClient().invoices.del(invoiceId);
    },
  })
);
