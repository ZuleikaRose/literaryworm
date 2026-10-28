/**
 * Where the Supabase backend is. Both values are public by design: the URL, and the
 * publishable key, which only grants what Row Level Security allows the anon role.
 * Without them the app runs on its sample catalog.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
export const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const usesBackend = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);
