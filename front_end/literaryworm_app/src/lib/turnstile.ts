// Cloudflare Turnstile on the log-in and sign-up pages (components/Turnstile.tsx). Supabase Auth's
// CAPTCHA protection checks the token on sign-up, password log-in, password reset and resending the
// confirmation email; the browser only collects it. Loaded only when the app has a backend.

import { ESSENTIAL } from "./consent";

/** The widget's script, rendered explicitly so React decides where and when. */
export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** What each form tells Turnstile it is (shown in Cloudflare's analytics; letters, digits, _ and -). */
export type TurnstileAction = "login" | "signup" | "reset-password" | "resend-confirmation";

export interface TurnstileOptions {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  language?: string;
  appearance?: "always" | "execute" | "interaction-only";
  "response-field"?: boolean;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (code: string) => boolean | void;
  "timeout-callback"?: () => void;
}

export interface TurnstileApi {
  render: (el: HTMLElement, options: TurnstileOptions) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/**
 * Loads Turnstile's script once. It's marked essential for Termly's resource blocker (it protects
 * logging in, so it can't wait for consent) and sets no cookies of ours.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    // Before src: Termly decides as the address is set.
    script.setAttribute("data-categories", ESSENTIAL["data-categories"]);
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't start")));
    script.onerror = () => reject(new Error("Turnstile couldn't load"));
    script.src = TURNSTILE_SCRIPT;
    document.head.append(script);
  }).catch((err: Error) => {
    loading = null; // let the next form try again
    throw err;
  });
  return loading;
}

/** Turnstile's language for the app's (Turnstile names a few by region; "auto" follows the browser). */
export function turnstileLanguage(ui: string): string {
  const named: Record<string, string> = { zh: "zh-cn", pt: "pt-br", tl: "tl" };
  return named[ui] ?? ui;
}
