/**
 * The unit tests' stand-in for ./backend (jest.config.js maps it here): Jest's CommonJS can't
 * read import.meta.env, and the tests run as the app does without Supabase settings.
 */
export const SUPABASE_URL: string | undefined = undefined;
export const PUBLISHABLE_KEY: string | undefined = undefined;
export const usesBackend = false;
export const TURNSTILE_SITE_KEY: string | undefined = undefined;
