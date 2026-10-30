import { allowedOrigins } from "../_shared/cors.ts";
import { sendWithMailgun } from "../_shared/mailgun.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { discountView, type InvoiceView, invoiceView, releaseSchedule, Stripe, stripeClient } from "../_shared/stripe.ts";
import { customerFor, monthlyPrice } from "../_shared/stripeCustomers.ts";
import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { type Gift, handle, type Subscription, type SubscriptionPatch } from "./handler.ts";

// Enough of each discount to show it: the coupon's terms and the code the member typed.
const DISCOUNT_EXPAND = ["discounts.source.coupon", "discounts.promotion_code"];

const COLUMNS =
  "plan_id, status, billing_interval, billing_day, cancel_at_period_end, current_period_end, cancel_at, complimentary, gift_until, switch_to_monthly, stripe_subscription_id, stripe_customer_id";

Deno.serve((req) =>
  handle(req, {
    requireUser,
    confirmPassword,
    billing: {
      // Void (don't charge) any invoices while paused; resuming clears it.
      pause: async (id) => void (await stripeClient().subscriptions.update(id, { pause_collection: { behavior: "void" } })),
      resume: async (id) => void (await stripeClient().subscriptions.update(id, { pause_collection: "" })),
      // Stripe refuses to cancel a subscription with a schedule (a yearly one moving to monthly at
      // renewal), so cancelling drops that move first.
      async setCancelAtPeriodEnd(id, cancel) {
        if (cancel) await releaseSchedule(stripeClient(), id);
        await stripeClient().subscriptions.update(id, { cancel_at_period_end: cancel });
      },
      // At a period's end, so the last period is whole and nothing is prorated.
      async cancelAt(id, at) {
        await releaseSchedule(stripeClient(), id);
        await stripeClient().subscriptions.update(id, { cancel_at: at, proration_behavior: "none" });
      },
      clearCancelAt: async (id) => void (await stripeClient().subscriptions.update(id, { cancel_at: "" })),
      async cancelNow(id) {
        await releaseSchedule(stripeClient(), id);
        await stripeClient().subscriptions.cancel(id, { invoice_now: false, prorate: false });
      },
      // A free stretch until the new date, which becomes the billing day from then on.
      moveRenewal: async (id, until) =>
        void (await stripeClient().subscriptions.update(id, { trial_end: until, proration_behavior: "none" })),
      async extendForGift(id, until) {
        await releaseSchedule(stripeClient(), id);
        await stripeClient().subscriptions.update(id, {
          trial_end: until,
          proration_behavior: "none",
          metadata: { gift_until: String(until) },
        });
      },
      async startGift({ giftId, customerId, planId, until, consentAt }) {
        await stripeClient().subscriptions.create(
          {
            customer: customerId,
            items: [{ price: (await monthlyPrice(planId)).id }],
            trial_end: until,
            // No card is needed for the gift; without one, the membership ends when it does.
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
            metadata: { plan_id: planId, gift_until: String(until), gift_consent_at: consentAt },
          },
          // One subscription per gift and account, however often the request is retried; with the
          // customer in the key, a code given back after a failure can still go to someone else.
          { idempotencyKey: `gift-${giftId}-${customerId}` },
        );
      },
      async paymentMethodUrl(customerId, returnUrl) {
        const session = await stripeClient().billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: { type: "payment_method_update" },
        });
        return session.url;
      },
      async invoices(customerId) {
        const { data } = await stripeClient().invoices.list({ customer: customerId, limit: 24 });
        return data.map(invoiceView).filter((i): i is InvoiceView => i !== null);
      },
      async discount(subscriptionId) {
        const sub = await stripeClient().subscriptions.retrieve(subscriptionId, { expand: DISCOUNT_EXPAND });
        return discountView(sub.discounts);
      },
      async redeem(subscriptionId, code) {
        const stripe = stripeClient();
        const { data } = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
        if (!data[0]) return null;
        try {
          const sub = await stripe.subscriptions.update(subscriptionId, {
            discounts: [{ promotion_code: data[0].id }],
            expand: DISCOUNT_EXPAND,
          });
          return discountView(sub.discounts);
        } catch (err) {
          // Expired, used up, first-time-only or minimum-amount codes: Stripe refuses them here.
          if (err instanceof Stripe.errors.StripeInvalidRequestError) return null;
          throw err;
        }
      },
    },
    customerFor,
    gifts: {
      async find(code) {
        const { data, error } = await serviceClient().from("gift_codes").select("id, plan_id, months, redeemed_at").eq("code", code).maybeSingle();
        if (error) throw error;
        return data as Gift | null;
      },
      async claim(giftId, userId) {
        // Only an unredeemed code changes, so two people redeeming at once can't both get it.
        const { data, error } = await serviceClient()
          .from("gift_codes")
          .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
          .eq("id", giftId)
          .is("redeemed_at", null)
          .select("id");
        if (error) throw error;
        return data.length === 1;
      },
      async release(giftId) {
        const { error } = await serviceClient().from("gift_codes").update({ redeemed_by: null, redeemed_at: null }).eq("id", giftId);
        if (error) throw error;
      },
    },
    siteOrigin(req) {
      const origins = allowedOrigins();
      const origin = req.headers.get("Origin");
      return origin && origins.includes(origin) ? origin : (origins.find((o) => o.startsWith("https://www.")) ?? origins[0]);
    },
    // A handful of changes a minute is plenty for a person; it stops scripted password guessing on delete.
    rateLimit: (userId) => enforceRateLimit(`manage-account:${userId}`, 10, 60),
    async getSubscription(userId) {
      const { data, error } = await serviceClient().from("subscriptions").select(COLUMNS).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
    async updateSubscription(userId, patch: SubscriptionPatch) {
      const { data, error } = await serviceClient()
        .from("subscriptions")
        .update(patch)
        .eq("user_id", userId)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as Subscription;
    },
    // A one-off service email: no unsubscribe link, since there's nothing left to unsubscribe from.
    sendEmail: (email) => sendWithMailgun({ ...email, tag: "account-deleted" }),
    async deleteUser(userId) {
      const db = serviceClient();
      // Uploaded books' text lives in Storage, in a folder named after the account: delete it
      // first, so nothing is left behind once the account has gone.
      const { data: files, error: listError } = await db.storage.from("user-books").list(userId, { limit: 1000 });
      if (listError) throw listError;
      if (files.length) {
        const { error: removeError } = await db.storage.from("user-books").remove(files.map((f) => `${userId}/${f.name}`));
        if (removeError) throw removeError;
      }
      // Every table the account owns references auth.users (directly or through
      // library_items and profiles) with on delete cascade.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  })
);
