/**
 * Where the Supabase backend is. Both values are public by design: the URL, and the
 * publishable key, which only grants what Row Level Security allows the anon role.
 * Without them the app runs on its sample catalog.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
export const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const usesBackend = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

/**
 * Cloudflare Turnstile's site key for the log-in and sign-up pages (public; the widget allows
 * literaryworm.com and its subdomains, and localhost). Its secret is in Supabase Auth's CAPTCHA
 * protection setting, never here. VITE_TURNSTILE_SITE_KEY overrides it (the e2e run uses
 * Cloudflare's always-passing test key); set it to "off" to leave the widget out.
 */
const TURNSTILE_SETTING = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const TURNSTILE_SITE_KEY: string | undefined = usesBackend
  ? TURNSTILE_SETTING === "off"
    ? undefined
    : TURNSTILE_SETTING || "0x4AAAAAAGVtBWKBg5hkacdX"
  : undefined;
