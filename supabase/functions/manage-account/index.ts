import { allowedOrigins } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { handle, type Subscription, type SubscriptionPatch } from "./handler.ts";

const COLUMNS =
  "plan_id, status, billing_day, cancel_at_period_end, current_period_end, complimentary, stripe_subscription_id, stripe_customer_id";

Deno.serve((req) =>
  handle(req, {
    requireUser,
    confirmPassword,
    billing: {
      // Void (don't charge) any invoices while paused; resuming clears it.
      pause: async (id) => void (await stripeClient().subscriptions.update(id, { pause_collection: { behavior: "void" } })),
      resume: async (id) => void (await stripeClient().subscriptions.update(id, { pause_collection: "" })),
      setCancelAtPeriodEnd: async (id, cancel) => void (await stripeClient().subscriptions.update(id, { cancel_at_period_end: cancel })),
      cancelNow: async (id) => void (await stripeClient().subscriptions.cancel(id, { invoice_now: false, prorate: false })),
      // A free stretch until the new date, which becomes the billing day from then on.
      moveRenewal: async (id, until) =>
        void (await stripeClient().subscriptions.update(id, { trial_end: until, proration_behavior: "none" })),
      async paymentMethodUrl(customerId, returnUrl) {
        const session = await stripeClient().billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: { type: "payment_method_update" },
        });
        return session.url;
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
