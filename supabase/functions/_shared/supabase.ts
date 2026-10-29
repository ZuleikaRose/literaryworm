// Supabase clients for Edge Functions. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by the platform; nothing is hard-coded.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.49.4";
import { HttpError } from "./http.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Use only after checking who the caller is. */
export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), noSession);
}

/** The session's assurance level ("aal1", or "aal2" after a two-step code), read from a JWT Auth has verified. */
export function sessionAal(token: string): string | undefined {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const aal = JSON.parse(atob(payload))?.aal;
    return typeof aal === "string" ? aal : undefined;
  } catch {
    return undefined;
  }
}

/** True when the member has turned on two-step sign-in and this session hasn't given the code. */
export function needsSecondStep(user: Pick<User, "factors">, token: string): boolean {
  const twoStep = (user.factors ?? []).some((f) => f.status === "verified");
  return twoStep && sessionAal(token) !== "aal2";
}

/**
 * Verifies the caller's JWT with Supabase Auth and returns the user. A member with two-step
 * sign-in must have given the code in this session, as the database's policies also require.
 */
export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError("unauthorized", "Log in to do that.");
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError("unauthorized", "Your session has ended. Log in again.");
  if (needsSecondStep(data.user, token)) {
    throw new HttpError("unauthorized", "Enter the code from your authenticator app to finish logging in.");
  }
  return data.user;
}

/** Re-checks the account password before sensitive changes. */
export async function confirmPassword(email: string, password: string): Promise<void> {
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new HttpError("forbidden", "That password isn't right.");
}
