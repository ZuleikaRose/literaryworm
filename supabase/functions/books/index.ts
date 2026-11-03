import { supabaseBookCache } from "../_shared/bookCache.ts";
import { googleKeys } from "../_shared/googleBooks.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { handle } from "./handler.ts";

// 60 requests a minute per IP: plenty for scrolling, not enough to drain the
// Google Books quota through us.
Deno.serve((req) =>
  handle(req, {
    // The main key, then the fallbacks, tried in turn when Google refuses or fails one.
    apiKeys: googleKeys(),
    rateLimit: (r) => enforceRateLimit(`books:${clientIp(r)}`, 60, 60),
    // Google's answers kept in Supabase, so each is asked for once (migration 6666).
    cache: supabaseBookCache(serviceClient()),
  })
);
