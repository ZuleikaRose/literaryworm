import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    async member(r) {
      const user = await requireUser(r);
      return { id: user.id, email: user.email };
    },
    async mayTry(userId) {
      const { data, error } = await serviceClient().rpc("check_rate_limit", {
        p_key: `check-password:${userId}`,
        p_limit: 20,
        p_window_seconds: 900,
      });
      if (error) throw new Error(`check-password: rate limit check failed: ${error.message}`);
      return data === true;
    },
    confirm: confirmPassword,
  })
);
