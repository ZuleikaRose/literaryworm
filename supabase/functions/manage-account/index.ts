import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { handle, type Subscription, type SubscriptionPatch } from "./handler.ts";

const COLUMNS = "plan_id, status, billing_day, cancel_at_period_end, current_period_end";

Deno.serve((req) =>
  handle(req, {
    requireUser,
    confirmPassword,
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
      // Every table the account owns references auth.users (directly or through
      // library_items and profiles) with on delete cascade.
      const { error } = await serviceClient().auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  })
);
