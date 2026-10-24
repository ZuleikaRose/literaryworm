import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/** Where the session is kept (the one thing in browser storage). */
export const SESSION_STORAGE_KEY = "bookworm-session";

/**
 * The browser's Supabase client, or null when no backend is configured (the app then runs
 * on its sample data and in-memory accounts).
 *
 * The session is the one thing kept in browser storage, so a member stays signed in after a
 * refresh; everything else in the app still lives in memory. It holds only Supabase's
 * short-lived access token and refresh token, never the password.
 */
export const supabase: SupabaseClient | null = usesBackend
  ? createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: SESSION_STORAGE_KEY },
    })
  : null;
