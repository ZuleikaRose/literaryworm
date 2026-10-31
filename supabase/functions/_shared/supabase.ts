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

function claims(token: string): Record<string, unknown> | undefined {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(payload));
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** The session's assurance level ("aal1", or "aal2" after a two-step code), read from a JWT Auth has verified. */
export function sessionAal(token: string): string | undefined {
  const aal = claims(token)?.aal;
  return typeof aal === "string" ? aal : undefined;
}

/** True when the session logged in with a passkey (Auth's amr names the method). */
export function usedPasskey(token: string): boolean {
  const amr = claims(token)?.amr;
  return Array.isArray(amr) && amr.some((m) => m && typeof m === "object" && (m as { method?: unknown }).method === "passkey");
}

/**
 * Asks the database's second_step_done() as the caller: a passkey session counts as the second step
 * only when every passkey on the account was added after the code (trusted_passkeys, migration 6530).
 */
async function passkeyCounts(token: string): Promise<boolean> {
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc("second_step_done");
  if (error) console.error("second step: couldn't check the passkey:", error.message);
  return !error && data === true;
}

/** True when the member has turned on two-step sign-in and this session hasn't given the code. */
export function needsSecondStep(user: Pick<User, "factors">, token: string): boolean {
  const twoStep = (user.factors ?? []).some((f) => f.status === "verified");
  return twoStep && sessionAal(token) !== "aal2";
}

/**
 * Verifies the caller's JWT with Supabase Auth and returns the user. A member with two-step
 * sign-in must have given the code in this session, or logged in with a trusted passkey, as the
 * database's policies also require.
 */
export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError("unauthorized", "Log in to do that.");
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError("unauthorized", "Your session has ended. Log in again.");
  if (needsSecondStep(data.user, token) && !(usedPasskey(token) && (await passkeyCounts(token)))) {
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
