import { type FormEvent, useId, useState } from "react";
import { LOG_MAX } from "../data/logs";
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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Public reading log"
      title={initial ? "Edit your log" : "What stayed with you?"}
      description={
        <p>
          Share a thought about <strong>{bookTitle}</strong>. Anyone can read logs on the book's page, with your
          display name. Your library stays private.
        </p>
      }
    >
      {/* Keyed so each opening starts from the log being edited, or blank. */}
      {open && <LogForm key={initial ? "edit" : "new"} postingAs={postingAs} initial={initial} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function LogForm({ postingAs, initial, onSubmit }: Pick<LogDialogProps, "postingAs" | "initial" | "onSubmit">) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const length = body.trim().length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (length === 0) return setError("Write something before publishing your log.");
    if (length > LOG_MAX) return setError(`Logs can be up to ${numberFormat.format(LOG_MAX)} characters. Shorten it a little.`);
    onSubmit(body, rating);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={id}>
          Your log
        </label>
        <textarea
          id={id}
          className="field-input log-textarea"
          rows={7}
          value={body}
          placeholder="An idea, a moment or a passage that stayed with you"
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
          {numberFormat.format(length)} of {numberFormat.format(LOG_MAX)} characters
        </p>
      </div>

      <fieldset className="form-group log-rating-field">
        <legend className="field-label">Rating (optional)</legend>
        <div className="chip-group chip-group-lg">
          <label className="chip">
            <input type="radio" name={`${id}-rating`} checked={rating === null} onChange={() => setRating(null)} />
            <span>No rating</span>
          </label>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="chip">
              {/* The label reads "3 out of 5" (.chip span styles every nested span, so no hidden text inside). */}
              <input
                type="radio"
                name={`${id}-rating`}
                aria-label={`${n} out of 5`}
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
          <Icon name="user" size={14} /> Posting as {postingAs}
        </span>
        <button type="submit" className="primary-button">
          {initial ? "Save changes" : "Publish log"}
        </button>
      </div>
    </form>
  );
}
