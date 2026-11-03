import { type FormEvent, useId, useState } from "react";
import { AccountError } from "../lib/accountApi";
import { entriesFor, JOURNAL_BODY_MAX, journalDay } from "../lib/journal";
import { today } from "../lib/reading";
import { dateLocale } from "../lib/i18n";
import { useJournal } from "../lib/useJournal";
import { useT } from "../lib/useT";
import type { JournalEntry } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * The book page's *My journal*: the active profile's private, dated entries about this book
 * (lib/useJournal.ts), apart from the public reader logs. Write, edit and delete; exported with
 * the notes in My Library → Notes.
 */
export function JournalSection({ bookId, title }: { bookId: string; title: string }) {
  const t = useT();
  const { journal, add, update, remove } = useJournal();
  const entries = entriesFor(journal, bookId);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="journal-section" id="journal" aria-labelledby="journal-title">
      <div className="logs-intro">
        <p className="eyebrow">{t("Only you")}</p>
        <h2 id="journal-title" tabIndex={-1}>
          {t("My journal")}
        </h2>
        <p>{t("Private notes about {title}, by day. Never shown on the book's page or to other readers.", { title })}</p>
      </div>
      <div className="journal-body">
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
        <JournalForm
          key={editing?.id ?? "new"}
          entry={editing}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSave={async (body, writtenOn) => {
            if (editing) {
              await update(editing.id, body, writtenOn);
              setEditing(null);
              setAnnouncement(t("Journal entry saved."));
            } else {
              await add(bookId, body, writtenOn);
              setAnnouncement(t("Added to your journal."));
            }
          }}
        />
        {error && (
          <p className="form-alert" role="alert">
            <Icon name="alert" size={17} /> <span>{error}</span>
          </p>
        )}
        {entries.length > 0 && (
          <ol className="journal-list" aria-label={t("Journal entries for {title}", { title })}>
            {entries.map((e) => (
              <li key={e.id} className="journal-entry">
                <h3>
                  <time dateTime={e.writtenOn}>{journalDay(e.writtenOn)}</time>
                </h3>
                <p className="journal-text">{e.body}</p>
                <div className="highlight-item-actions">
                  <button type="button" className="text-button" onClick={() => setEditing(e)}>
                    {t("Edit")}<span className="visually-hidden">{t(" the entry for {day}", { day: journalDay(e.writtenOn) })}</span>
                  </button>
                  <button type="button" className="text-button danger-text" onClick={() => setDeleting(e)}>
                    {t("Delete")}<span className="visually-hidden">{t(" the entry for {day}", { day: journalDay(e.writtenOn) })}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} size="sm" title={t("Delete this journal entry?")}>
        <p>{t("The entry for {day} is deleted for good.", { day: deleting ? journalDay(deleting.writtenOn) : "" })}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="danger-button"
            onClick={async () => {
              const entry = deleting;
              setDeleting(null);
              if (!entry) return;
              setError(null);
              try {
                await remove(entry.id);
                if (editing?.id === entry.id) setEditing(null);
                setAnnouncement(t("Journal entry deleted."));
              } catch (err) {
                setError(err instanceof AccountError ? err.message : t("We couldn't delete the entry. Try again."));
              }
            }}
          >
            {t("Delete entry")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setDeleting(null)}>
            {t("Keep it")}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

function JournalForm({ entry, onSave, onCancel }: { entry: JournalEntry | null; onSave: (body: string, writtenOn: string) => Promise<void>; onCancel?: () => void }) {
  const t = useT();
  const [body, setBody] = useState(entry?.body ?? "");
  const [day, setDay] = useState(entry?.writtenOn ?? today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textId = useId();
  const dayId = useId();
  const errorId = useId();
  const hintId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(body, day);
      if (!entry) setBody("");
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("We couldn't save the entry. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="journal-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={textId}>
          {entry ? t("Edit the entry") : t("New entry")}
        </label>
        <textarea
          id={textId}
          className="field-input journal-textarea"
          rows={4}
          value={body}
          maxLength={JOURNAL_BODY_MAX}
          placeholder={t("What happened, what you thought, where you read it")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
        />
        <p className="field-hint" id={hintId}>
          {t("{n} of {max} characters.", { n: body.trim().length.toLocaleString(dateLocale(t.lang)), max: JOURNAL_BODY_MAX.toLocaleString(dateLocale(t.lang)) })}
        </p>
        {error && (
          <p className="field-error" id={errorId}>
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
      </div>
      <div className="journal-form-foot">
        <div className="field journal-day">
          <label className="field-label" htmlFor={dayId}>
            {t("Day")}
          </label>
          <input id={dayId} type="date" className="field-input" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="journal-form-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? t("Saving…") : entry ? t("Save entry") : t("Add to journal")}
          </button>
          {onCancel && (
            <button type="button" className="secondary-button" onClick={onCancel}>
              {t("Cancel")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
