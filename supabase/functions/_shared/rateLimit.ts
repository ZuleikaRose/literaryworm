// Fixed-window rate limits stored in Postgres (private.rate_limits via
// public.check_rate_limit). Keys are hashed in the database.

import { HttpError } from "./http.ts";
import { serviceClient } from "./supabase.ts";

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const { data, error } = await serviceClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Don't take the app down if the limiter itself fails; log it.
    console.error("rate limit check failed", error.message);
    return;
  }
  if (data === false) {
    throw new HttpError("rate_limited", "Too many requests. Wait a moment and try again.", windowSeconds);
  }
}
