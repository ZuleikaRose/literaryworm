import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AccountError } from "../lib/accountApi";
import { type EmailList, unsubscribe } from "../lib/changelogApi";
import { rich, tk } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";

/** What each email is called, where it's turned back on, and the page to offer instead. */
const LISTS: Record<EmailList, { name: string; ask: string; settings: string; place: string; instead: { to: string; label: string } }> = {
  "whats-new": {
    name: tk("the monthly What's new email"),
    ask: tk("Stop getting the monthly email of what's new in LiteraryWorm?"),
    settings: "/account#preferences",
    place: tk("Account → Preferences"),
    instead: { to: "/whats-new", label: tk("See what's new instead") },
  },
  "kids-report": {
    name: tk("the weekly Kids reading report"),
    ask: tk("Stop getting the weekly email of how the Kids profiles read?"),
    settings: "/account#family",
    place: tk("Account → Family"),
    instead: { to: "/account#family", label: tk("See it in Account instead") },
  },
  "club-meetings": {
    name: tk("book club meeting emails"),
    ask: tk("Stop getting an email the day before your book clubs meet, and when a meeting moves or is cancelled?"),
    settings: "/account#preferences",
    place: tk("Account → Preferences"),
    instead: { to: "/library?view=clubs", label: tk("See your clubs instead") },
  },
  "club-posts": {
    name: tk("the daily book club posts email"),
    ask: tk("Stop getting a daily email of new posts in your book clubs?"),
    settings: "/account#preferences",
    place: tk("Account → Preferences"),
    instead: { to: "/library?view=clubs", label: tk("See your clubs instead") },
  },
};

/**
 * /unsubscribe?t=…&l=…: the link in the monthly What's new email (no `l`), the weekly Kids
 * reading report (`l=kids-report`) a book club meeting reminder (`l=club-meetings`) or the daily club posts email (`l=club-posts`). It asks before unsubscribing,
 * so a link-checker opening the page changes nothing; mail apps' one-click button goes to the
 * unsubscribe function directly.
 */
export default function Unsubscribe() {
  const t = useT();
  useTitle(t("Unsubscribe"));
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const given = params.get("l");
  const list: EmailList = given === "kids-report" || given === "club-meetings" || given === "club-posts" ? given : "whats-new";
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
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      setStatus("ready");
    }
  };

  return (
    <article className="page legal-page">
      <h1>{t("Unsubscribe")}</h1>
      {status === "done" ? (
        <p className="form-success" role="status">
          <Icon name="check" size={17} />{" "}
          {rich(t("You won't get {name} any more. You can turn it back on in {place}."), {
            name: t(about.name),
            place: <Link to={about.settings}>{t(about.place)}</Link>,
          })}
        </p>
      ) : !token ? (
        <p>
          {rich(t("This link is missing its code. Turn the email off in {place} instead."), {
            place: <Link to={about.settings}>{t(about.place)}</Link>,
          })}
        </p>
      ) : (
        <>
          <p className="legal-summary">{t(about.ask)} {t("Other emails, like receipts and password resets, still arrive.")}</p>
          {error && (
            <div className="form-alert" role="alert">
              <Icon name="alert" size={17} />
              <p>{error}</p>
            </div>
          )}
          <div className="goal-actions">
            <button type="button" className="primary-button" disabled={status === "busy"} onClick={confirm}>
              {status === "busy" ? t("Unsubscribing…") : t("Unsubscribe")}
            </button>
            <Link className="secondary-button" to={about.instead.to}>
              {t(about.instead.label)}
            </Link>
          </div>
        </>
      )}
    </article>
  );
}
