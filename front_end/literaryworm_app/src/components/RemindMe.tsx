import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountError } from "../lib/accountApi";
import type { DetailView } from "../lib/bookDetail";
import { rich } from "../lib/i18n";
import { useReminders } from "../lib/useReminders";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * On the page of a book that isn't out yet: when it's due, and Remind me (a profile's
 * reminder, shown on Home once the day comes). Needs the exact day from Google Books.
 */
export function RemindMe({ view, release }: { view: DetailView; release: NonNullable<DetailView["release"]> }) {
  const reminders = useReminders();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const set = reminders.has(view.id);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (set) {
        await reminders.remove(view.id);
        setAnnouncement(t("Reminder removed."));
      } else {
        await reminders.add({ bookId: view.id, title: view.title, author: view.authors[0] ?? null, releaseDate: release.date });
        setAnnouncement(reminders.emails ? t("We'll remind you on Home and by email when it's out on {date}.", { date: release.label }) : t("We'll remind you on Home when it's out on {date}.", { date: release.label }));
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="remind-me">
      <p className="remind-me-date">
        <Icon name="clock" size={16} />
        <span>
          {rich(t("Not out yet: due {date}"), { date: <strong>{release.label}</strong> })}
        </span>
      </p>
      {release.exact ? (
        <>
          <button
            type="button"
            className={set ? "secondary-button" : "primary-button"}
            aria-pressed={set}
            aria-describedby={error ? "remind-error" : "remind-hint"}
            disabled={busy}
            onClick={toggle}
          >
            <Icon name={set ? "check" : "bell"} size={16} /> {set ? t("Reminder set") : t("Remind me")}
          </button>
          <p className="remind-me-hint" id="remind-hint">
            {set ? (
              <>
                {rich(reminders.emails ? t("It's on Home on the day, and we'll email you. Until then it's in {link}.") : t("It's on Home on the day. Until then it's in {link}."), {
                  link: <Link to="/library?view=reminders">{t("My Library → Reminders")}</Link>,
                })}
              </>
            ) : reminders.emails ? (
              t("We'll show it on Home and email you on the day it's out.")
            ) : (
              t("We'll show it on Home on the day it's out.")
            )}
          </p>
        </>
      ) : (
        <p className="remind-me-hint">{t("Remind me needs an exact release day, which Google Books doesn't have yet.")}</p>
      )}
      {error && (
        <p className="field-error" id="remind-error" role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}
