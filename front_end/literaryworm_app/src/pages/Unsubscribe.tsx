import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AccountError } from "../lib/accountApi";
import { unsubscribe } from "../lib/changelogApi";
import { useTitle } from "../lib/useTitle";

/**
 * /unsubscribe?t=…: the link in the monthly What's new email. It asks before unsubscribing,
 * so a link-checker opening the page changes nothing; mail apps' one-click button goes to the
 * unsubscribe function directly.
 */
export default function Unsubscribe() {
  useTitle("Unsubscribe");
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [status, setStatus] = useState<"ready" | "busy" | "done">("ready");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setStatus("busy");
    setError(null);
    try {
      await unsubscribe(token);
      setStatus("done");
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
      setStatus("ready");
    }
  };

  return (
    <article className="page legal-page">
      <h1>Unsubscribe</h1>
      {status === "done" ? (
        <p className="form-success" role="status">
          <Icon name="check" size={17} /> You won't get the monthly What's new email any more. You can turn it back on in{" "}
          <Link to="/account#preferences">Account → Preferences</Link>.
        </p>
      ) : !token ? (
        <p>
          This link is missing its code. Turn the email off in <Link to="/account#preferences">Account → Preferences</Link> instead.
        </p>
      ) : (
        <>
          <p className="legal-summary">Stop getting the monthly email of what's new in LiteraryWorm? Other emails, like receipts and password resets, still arrive.</p>
          {error && (
            <div className="form-alert" role="alert">
              <Icon name="alert" size={17} />
              <p>{error}</p>
            </div>
          )}
          <div className="goal-actions">
            <button type="button" className="primary-button" disabled={status === "busy"} onClick={confirm}>
              {status === "busy" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
            <Link className="secondary-button" to="/whats-new">
              See what's new instead
            </Link>
          </div>
        </>
      )}
    </article>
  );
}
