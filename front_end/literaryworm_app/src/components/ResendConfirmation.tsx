import { useEffect, useState } from "react";
import { AccountError, resendConfirmation } from "../lib/accountApi";
import { Icon } from "./Icon";

/** Supabase sends at most one confirmation email a minute to an address. */
const WAIT_SECONDS = 60;

/** *Send the email again* for an address that isn't confirmed yet (sign-up and log-in). */
export function ResendConfirmation({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send() {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await resendConfirmation(email);
      setSent(true);
      setWait(WAIT_SECONDS);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="resend-confirmation">
      <button type="button" className="secondary-button auth-submit" disabled={busy || wait > 0} onClick={send}>
        <Icon name="mail" size={16} /> {wait > 0 ? `Send again in ${wait} s` : "Send the email again"}
      </button>
      {sent && (
        <div className="form-success" role="status">
          <Icon name="check" size={17} />
          <p>
            Sent again to <strong>{email.trim()}</strong>. It can take a few minutes to arrive.
          </p>
        </div>
      )}
      {error && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
