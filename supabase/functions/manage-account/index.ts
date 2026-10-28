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
