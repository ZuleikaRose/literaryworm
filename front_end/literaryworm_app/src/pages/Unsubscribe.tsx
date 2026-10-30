import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AccountError } from "../lib/accountApi";
import { type EmailList, unsubscribe } from "../lib/changelogApi";
import { useTitle } from "../lib/useTitle";

/** What each email is called, where it's turned back on, and the page to offer instead. */
const LISTS: Record<EmailList, { name: string; ask: string; settings: string; place: string; instead: { to: string; label: string } }> = {
  "whats-new": {
    name: "the monthly What's new email",
    ask: "Stop getting the monthly email of what's new in LiteraryWorm?",
    settings: "/account#preferences",
    place: "Account → Preferences",
    instead: { to: "/whats-new", label: "See what's new instead" },
  },
  "kids-report": {
    name: "the weekly Kids reading report",
    ask: "Stop getting the weekly email of how the Kids profiles read?",
    settings: "/account#family",
    place: "Account → Family",
    instead: { to: "/account#family", label: "See it in Account instead" },
  },
};

/**
 * /unsubscribe?t=…&l=…: the link in the monthly What's new email (no `l`) or the weekly Kids
 * reading report (`l=kids-report`). It asks before unsubscribing,
 * so a link-checker opening the page changes nothing; mail apps' one-click button goes to the
 * unsubscribe function directly.
 */
export default function Unsubscribe() {
  useTitle("Unsubscribe");
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const list: EmailList = params.get("l") === "kids-report" ? "kids-report" : "whats-new";
  const about = LISTS[list];
  const [status, setStatus] = useState<"ready" | "busy" | "done">("ready");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setStatus("busy");
    setError(null);
    try {
      await unsubscribe(token, list);
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
          <Icon name="check" size={17} /> You won't get {about.name} any more. You can turn it back on in{" "}
          <Link to={about.settings}>{about.place}</Link>.
        </p>
      ) : !token ? (
        <p>
          This link is missing its code. Turn the email off in <Link to={about.settings}>{about.place}</Link> instead.
        </p>
      ) : (
        <>
          <p className="legal-summary">{about.ask} Other emails, like receipts and password resets, still arrive.</p>
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
            <Link className="secondary-button" to={about.instead.to}>
              {about.instead.label}
            </Link>
          </div>
        </>
      )}
    </article>
  );
}
