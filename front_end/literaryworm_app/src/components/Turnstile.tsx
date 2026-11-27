import type { TurnstileCheck } from "../lib/useTurnstile";
import { useT } from "../lib/useT";

/** Where a form's Cloudflare Turnstile check shows (lib/useTurnstile.ts); nothing without a backend. */
export function Turnstile({ check }: { check: TurnstileCheck }) {
  const t = useT();
  const { needed, place, problem } = check;
  if (!needed) return null;
  return (
    <div className="turnstile" role="group" aria-label={t("Security check")}>
      <div ref={place} className="turnstile-widget" />
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
