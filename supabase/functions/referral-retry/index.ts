// Deploy with JWT verification on; the handler also checks the caller's role. See handler.ts.
import { stripeClient } from "../_shared/stripe.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { referralDeps, type ReferralIo } from "../stripe-webhook/referral_io.ts";
import { handle } from "./handler.ts";

const io: ReferralIo = {
  db: () => serviceClient(),
  stripe: () => stripeClient() as unknown as ReturnType<ReferralIo["stripe"]>,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

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
      return (data as string | null) ?? null;
    },
    settle: referralDeps(io),
    async dismiss(eventId) {
      const { data, error } = await serviceClient().rpc("dismiss_referral_event", { p_event: eventId });
      if (error) throw error;
      return data === true;
    },
  })
);
