import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountError } from "../lib/accountApi";
import type { DetailView } from "../lib/bookDetail";
import { useReminders } from "../lib/useReminders";
import { Icon } from "./Icon";

/**
 * On the page of a book that isn't out yet: when it's due, and Remind me (a profile's
 * reminder, shown on Home once the day comes). Needs the exact day from Google Books.
 */
export function RemindMe({ view, release }: { view: DetailView; release: NonNullable<DetailView["release"]> }) {
  const reminders = useReminders();
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
        setAnnouncement("Reminder removed.");
      } else {
        await reminders.add({ bookId: view.id, title: view.title, author: view.authors[0] ?? null, releaseDate: release.date });
        setAnnouncement(`We'll remind you on Home${reminders.emails ? " and by email" : ""} when it's out on ${release.label}.`);
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="remind-me">
      <p className="remind-me-date">
        <Icon name="clock" size={16} />
        <span>
          Not out yet: due <strong>{release.label}</strong>
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
            <Icon name={set ? "check" : "bell"} size={16} /> {set ? "Reminder set" : "Remind me"}
          </button>
          <p className="remind-me-hint" id="remind-hint">
            {set ? (
              <>
                It's on Home on the day{reminders.emails ? ", and we'll email you" : ""}. Until then it's in{" "}
                <Link to="/library?view=reminders">My Library → Reminders</Link>.
              </>
            ) : reminders.emails ? (
              "We'll show it on Home and email you on the day it's out."
            ) : (
              "We'll show it on Home on the day it's out."
            )}
          </p>
        </>
      ) : (
        <p className="remind-me-hint">Remind me needs an exact release day, which Google Books doesn't have yet.</p>
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
