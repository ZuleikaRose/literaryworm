import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AccountError } from "../lib/accountApi";
import { isOut, releaseLabel } from "../lib/release";
import { useReminders } from "../lib/useReminders";
import type { Reminder } from "../types";
import { Icon } from "./Icon";

/** One reminder: the book, when it's due (or that it's out), and Remove or Dismiss. */
function ReminderRow({ reminder, onRemove, busy }: { reminder: Reminder; onRemove: () => void; busy: boolean }) {
  const out = isOut(reminder.releaseDate);
  return (
    <li className="reminder-row">
      <span className="reminder-what">
        <Link to={`/books/${reminder.bookId}`}>{reminder.title}</Link>
        {reminder.author && <small>{reminder.author}</small>}
      </span>
      <span className={out ? "reminder-when is-out" : "reminder-when"}>
        {out ? "Out now" : `Due ${releaseLabel(reminder.releaseDate)}`}
      </span>
      <button type="button" className="ghost-button" disabled={busy} onClick={onRemove}>
        {out ? "Dismiss" : "Remove"}
        <span className="visually-hidden"> the reminder for {reminder.title}</span>
      </button>
    </li>
  );
}

function useReminderRemoval() {
  const reminders = useReminders();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const remove = async (r: Reminder, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await reminders.remove(r.bookId);
      setAnnouncement(`Removed the reminder for ${r.title}.`);
      after?.();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { reminders, busy, error, announcement, remove };
}

function ReminderFeedback({ error, announcement }: { error: string | null; announcement: string }) {
  return (
    <>
      {error && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </>
  );
}

/** My Library → Reminders: every reminder, out first, then soonest. */
export function RemindersView() {
  const { reminders, busy, error, announcement, remove } = useReminderRemoval();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const all = [...reminders.released, ...reminders.upcoming];

  return (
    <section className="reminders-view" aria-labelledby="reminders-title">
      <h2 id="reminders-title" tabIndex={-1} ref={headingRef}>
        Reminders
      </h2>
      <p className="reminders-intro">
        Books that aren't out yet. On the day, they're shown on Home. Set one with <strong>Remind me</strong> on a book's
        page.
      </p>
      <ReminderFeedback error={error} announcement={announcement} />
      {all.length === 0 ? (
        <p className="reminders-empty">No reminders yet.</p>
      ) : (
        <ul className="reminder-list" role="list">
          {all.map((r) => (
            <ReminderRow key={r.bookId} reminder={r} busy={busy} onRemove={() => remove(r, () => headingRef.current?.focus())} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Home: books the profile asked to hear about that are out now. */
export function OutNow() {
  const { reminders, busy, error, announcement, remove } = useReminderRemoval();
  const headingRef = useRef<HTMLHeadingElement>(null);
  if (reminders.released.length === 0 && !announcement && !error) return null;

  return (
    <section className="out-now" aria-labelledby="out-now-title">
      <div className="out-now-heading">
        <span className="out-now-icon" aria-hidden="true">
          <Icon name="bell" size={20} />
        </span>
        <div>
          <p className="eyebrow">Your reminders</p>
          <h2 id="out-now-title" tabIndex={-1} ref={headingRef}>
            Out now
          </h2>
        </div>
        <Link className="text-button" to="/library?view=reminders">
          All reminders
        </Link>
      </div>
      <ReminderFeedback error={error} announcement={announcement} />
      {reminders.released.length > 0 && (
        <ul className="reminder-list" role="list">
          {reminders.released.map((r) => (
            <ReminderRow key={r.bookId} reminder={r} busy={busy} onRemove={() => remove(r, () => headingRef.current?.focus())} />
          ))}
        </ul>
      )}
    </section>
  );
}
