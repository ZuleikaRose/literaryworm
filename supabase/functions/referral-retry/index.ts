// Deploy with JWT verification on; the handler also checks the caller's role. See handler.ts.
import type { Stripe } from "../_shared/stripe.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { webhookDeps } from "../stripe-webhook/deps.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    requireUser,
    async isBilling(userId) {
      const { data, error } = await serviceClient().from("staff_roles").select("role").eq("user_id", userId).in("role", ["billing", "admin"]).limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async start(referralId) {
      const { data, error } = await serviceClient().rpc("referral_retry_start", { p_referral: referralId });
      if (error) throw error;
      const row = ((data ?? []) as { referred_id: string; decided: boolean }[])[0];
      return row ? { referredId: row.referred_id, decided: row.decided } : null;
    },
    async storedEvent(eventId) {
      const { data, error } = await serviceClient().from("stripe_events").select("review_payload").eq("id", eventId).maybeSingle();
      if (error) throw error;
      const payload = data?.review_payload as Stripe.Event | null | undefined;
      // Only the event it says it is.
      return payload && payload.id === eventId ? payload : null;
    },
    async recordReplay(eventId, ok, reason) {
      const { error } = await serviceClient().rpc("record_referral_event_replay", { p_event: eventId, p_ok: ok, p_reason: reason });
      if (error) throw error;
    },
    async dismiss(eventId) {
      const { data, error } = await serviceClient().rpc("dismiss_referral_event", { p_event: eventId });
      if (error) throw new Error(error.message);
      return data === true;
    },
    webhook: webhookDeps,
  })
);
