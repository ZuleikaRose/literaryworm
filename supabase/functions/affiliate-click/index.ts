import { clientIp } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    async firstToday(r, code) {
      // check_rate_limit hashes the key; one a day per visitor's IP and code.
      const { data, error } = await serviceClient().rpc("check_rate_limit", {
        p_key: `affiliate-click:${clientIp(r)}:${code}`,
        p_limit: 1,
        p_window_seconds: 86400,
      });
      if (error) {
        console.error("affiliate-click: rate limit check failed", error.message);
        return false;
      }
      return data === true;
    },
    async record(code) {
      const { error } = await serviceClient().rpc("record_affiliate_click", { p_code: code });
      if (error) console.error("affiliate-click: couldn't count", error.message);
    },
  })
);
