import { serviceClient } from "../_shared/supabase.ts";
import { type CheckResult, handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    async member(token) {
      const { data, error } = await serviceClient().auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, twoStep: (data.user.factors ?? []).some((f) => f.status === "verified") };
    },
    async check(userId, code) {
      const { data, error } = await serviceClient().rpc("check_recovery_code", { p_user: userId, p_code: code });
      if (error) throw new Error(`recovery-code: couldn't check the code: ${error.message}`);
      if (data !== "ok" && data !== "wrong" && data !== "rate_limited") throw new Error("recovery-code: unexpected answer");
      return data as CheckResult;
    },
    async turnOffTwoStep(userId) {
      const db = serviceClient();
      const { data, error } = await db.auth.admin.mfa.listFactors({ userId });
      if (error) throw new Error(`recovery-code: couldn't list factors: ${error.message}`);
      // Every authenticator factor, unfinished set-ups included, so a new set-up starts clean.
      for (const factor of data.factors) {
        if (factor.factor_type !== "totp") continue;
        const { error: removeError } = await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
        if (removeError) throw new Error(`recovery-code: couldn't remove a factor: ${removeError.message}`);
      }
      // The codes go only once two-step sign-in is off; if this fails they no longer work anyway
      // (they count only after a verified factor), and turning it on again makes new ones.
      const { error: deleteError } = await db.from("recovery_codes").delete().eq("user_id", userId);
      if (deleteError) console.error("recovery-code: couldn't delete the used codes:", deleteError.message);
    },
  })
);
