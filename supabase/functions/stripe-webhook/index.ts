// Deploy with JWT verification off (Stripe doesn't send a Supabase token); every request's
// Stripe signature is checked instead. See handler.ts.
import { webhookDeps } from "./deps.ts";
import { handle } from "./handler.ts";

Deno.serve((req) => handle(req, webhookDeps()));
