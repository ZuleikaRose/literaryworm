// Deploy with JWT verification off: mail apps and signed-out readers call it, and the signed
// token is the check.
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    async key() {
      const { data, error } = await serviceClient().rpc("unsubscribe_secret");
      if (error || typeof data !== "string" || !data) throw error ?? new Error("No unsubscribe key in Vault");
      return data;
    },
    async turnOff(userId) {
      const { error } = await serviceClient().from("account_private").update({ update_emails: false }).eq("user_id", userId);
      if (error) throw error;
    },
    // Plenty for a person or a mail app; stops anyone trying links in bulk.
    rateLimit: (r) => enforceRateLimit(`unsubscribe:${clientIp(r)}`, 30, 60),
  })
);
