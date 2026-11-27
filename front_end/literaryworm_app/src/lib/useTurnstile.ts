import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "./backend";
import { loadTurnstile, type TurnstileAction, turnstileLanguage } from "./turnstile";
import { useStore } from "../store/context";
import { useT } from "./useT";

export interface TurnstileCheck {
  /** True when the form must send a token (a backend and a site key); false without a backend. */
  needed: boolean;
  /** The current token, or null until Cloudflare's check finishes (or after it expires). */
  token: string | null;
  /** Clears the used token and runs the check again: Supabase Auth spends a token on every try. */
  reset: () => void;
  /** The callback ref for where components/Turnstile.tsx puts the widget. */
  place: (el: HTMLDivElement | null) => void;
  /** Why the check couldn't run, if it couldn't. */
  problem: string | null;
  /** What to say when the form is sent before the check is done. */
  waitMessage: string;
}

/**
 * Cloudflare Turnstile for a log-in, sign-up, reset or resend form (lib/turnstile.ts; shown with
 * components/Turnstile.tsx). The token goes to Supabase Auth with the request, which checks it with
 * Cloudflare. Skipped when the app has no backend, so the demo-only copy and the tests without
 * Supabase never load it; the demo's own log-in sends nothing and doesn't wait for it.
 */
export function useTurnstile(action: TurnstileAction): TurnstileCheck {
  const t = useT();
  const needed = Boolean(TURNSTILE_SITE_KEY);
  const [token, setToken] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The element itself (a callback ref into state), so the widget is drawn again wherever it moves.
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const language = turnstileLanguage(useStore().state.a11y.language);

  useEffect(() => {
    const sitekey = TURNSTILE_SITE_KEY;
    if (!sitekey || !holder) return;
    let live = true;
    loadTurnstile().then(
      (turnstile) => {
        if (!live) return;
        widgetId.current = turnstile.render(holder, {
          sitekey,
          action,
          theme: "auto",
          size: "flexible",
          language,
          "response-field": false,
          callback: (value) => {
            setToken(value);
            setProblem(null);
          },
          "expired-callback": () => setToken(null),
          "timeout-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setProblem(t("The security check couldn't finish. Reload the page, or try another browser or network."));
          },
        });
      },
      () => {
        if (live) setProblem(t("The security check couldn't load. Check your connection, and that nothing is blocking challenges.cloudflare.com, then reload the page."));
      },
    );
    return () => {
      live = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      setToken(null);
    };
  }, [holder, action, language, t]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  return { needed, token, reset, place: setHolder, problem, waitMessage: t("Wait for the security check to finish, then try again.") };
}
