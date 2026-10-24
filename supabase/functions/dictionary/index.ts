import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { handle } from "./handler.ts";

// 40 lookups a minute per IP: far more than anyone reading needs, and keeps us
// a polite client of the free API.
Deno.serve((req) =>
  handle(req, {
    rateLimit: (r) => enforceRateLimit(`dictionary:${clientIp(r)}`, 40, 60),
  })
);
