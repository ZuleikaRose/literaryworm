import { type FormEvent, useId, useState } from "react";
import { LOG_MAX } from "../data/logs";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

interface LogDialogProps {
  open: boolean;
  onClose: () => void;
  bookTitle: string;
  /** The display name the log will show. */
  postingAs: string;
  /** Set when editing an existing log. */
  initial?: { body: string; rating: number | null };
  onSubmit: (body: string, rating: number | null) => void;
}

const numberFormat = new Intl.NumberFormat();

/** Write or edit a public reading log: text (1–5000 characters) and an optional 1–5 rating. */
export function LogDialog({ open, onClose, bookTitle, postingAs, initial, onSubmit }: LogDialogProps) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={t("Public reading log")}
      title={initial ? t("Edit your log") : t("What stayed with you?")}
      description={
        <p>
          {rich(t("Share a thought about {title}. Anyone can read logs on the book's page, with your display name. Your library stays private."), {
            title: <strong>{bookTitle}</strong>,
          })}
        </p>
      }
    >
      {/* Keyed so each opening starts from the log being edited, or blank. */}
      {open && <LogForm key={initial ? "edit" : "new"} postingAs={postingAs} initial={initial} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function LogForm({ postingAs, initial, onSubmit }: Pick<LogDialogProps, "postingAs" | "initial" | "onSubmit">) {
  const t = useT();
  const [body, setBody] = useState(initial?.body ?? "");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const length = body.trim().length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (length === 0) return setError(t("Write something before publishing your log."));
    if (length > LOG_MAX) return setError(t("Logs can be up to {max} characters. Shorten it a little.", { max: numberFormat.format(LOG_MAX) }));
    onSubmit(body, rating);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {t("Your log")}
        </label>
        <textarea
          id={id}
          className="field-input log-textarea"
          rows={7}
          value={body}
          placeholder={t("An idea, a moment or a passage that stayed with you")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
        />
        {error && (
          <p className="field-error" id={errorId}>
            <Icon name="alert" size={15} />
            {error}
          </p>
        )}
        <p className={`field-hint${length > LOG_MAX ? " danger-text" : ""}`} id={hintId}>
          {t("{n} of {max} characters", { n: numberFormat.format(length), max: numberFormat.format(LOG_MAX) })}
        </p>
      </div>

      <fieldset className="form-group log-rating-field">
        <legend className="field-label">{t("Rating (optional)")}</legend>
        <div className="chip-group chip-group-lg">
          <label className="chip">
            <input type="radio" name={`${id}-rating`} checked={rating === null} onChange={() => setRating(null)} />
            <span>{t("No rating")}</span>
          </label>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="chip">
              {/* The label reads "3 out of 5" (.chip span styles every nested span, so no hidden text inside). */}
              <input
                type="radio"
                name={`${id}-rating`}
                aria-label={t("{n} out of 5", { n })}
                checked={rating === n}
                onChange={() => setRating(n)}
              />
              <span>
                <Icon name="star" size={14} filled />
                {n}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="log-form-foot">
        <span>
          <Icon name="user" size={14} /> {t("Posting as {name}", { name: postingAs })}
        </span>
        <button type="submit" className="primary-button">
          {initial ? t("Save changes") : t("Publish log")}
        </button>
      </div>
    </form>
  );
}
