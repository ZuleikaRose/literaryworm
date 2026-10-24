import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { handle } from "./handler.ts";

// 60 requests a minute per IP: plenty for scrolling, not enough to drain the
// Google Books quota through us.
Deno.serve((req) =>
  handle(req, {
    apiKey: Deno.env.get("GOOGLE_BOOKS_API_KEY"),
    rateLimit: (r) => enforceRateLimit(`books:${clientIp(r)}`, 60, 60),
  })
);
