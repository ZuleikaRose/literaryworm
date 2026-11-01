import { useId, useState } from "react";
import { AccountError } from "../lib/accountApi";
import { isEmptyMood, MOODS, MOODS_MAX, moodLabel, moodSummary, PACES, paceLabel, toggleMood } from "../lib/moods";
import { useCollections } from "../lib/useCollections";
import type { BookMood, Mood, Pace } from "../types";
import { Icon } from "./Icon";

/**
 * *How did it feel?* on the book page (lib/moods.ts): up to three moods and a pace, per profile,
 * saved first for members. Closed, it shows what's tagged; opened, the moods and paces as toggles.
 */
export function MoodPicker({ bookId }: { bookId: string }) {
  const collections = useCollections();
  const mood: BookMood = collections.moods[bookId] ?? { moods: [], pace: null };
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const errorId = useId();

  async function save(next: BookMood, done: string) {
    setBusy(true);
    setError(null);
    try {
      await collections.setMood(bookId, next);
      setMessage(done);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "We couldn't save the moods. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function pickMood(m: Mood) {
    const moods = toggleMood(mood.moods, m);
    if (!moods) {
      setError(`Pick up to ${MOODS_MAX} moods. Turn one off to choose ${moodLabel(m).toLowerCase()}.`);
      return;
    }
    void save({ ...mood, moods }, moods.includes(m) ? `Added ${moodLabel(m).toLowerCase()}.` : `Removed ${moodLabel(m).toLowerCase()}.`);
  }

  function pickPace(p: Pace) {
    const pace = mood.pace === p ? null : p;
    void save({ ...mood, pace }, pace ? `Pace: ${paceLabel(pace).toLowerCase()}.` : "Pace cleared.");
  }

  const summary = moodSummary(mood);
  return (
    <div className="mood-picker">
      <button type="button" className="text-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {isEmptyMood(mood) ? "How did it feel? Add moods and pace" : `How it felt: ${summary}`}
        <Icon name="chevronDown" size={14} className={open ? "flip" : undefined} />
      </button>
      <div id={panelId} hidden={!open}>
        <fieldset className="mood-group" aria-describedby={error ? errorId : undefined}>
          <legend>Moods (up to {MOODS_MAX})</legend>
          <div className="taste-row">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className="taste-button"
                aria-pressed={mood.moods.includes(m.value)}
                disabled={busy}
                onClick={() => pickMood(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mood-group">
          <legend>Pace</legend>
          <div className="taste-row">
            {PACES.map((p) => (
              <button key={p.value} type="button" className="taste-button" aria-pressed={mood.pace === p.value} disabled={busy} onClick={() => pickPace(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="field-error" id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="visually-hidden" role="status">
        {message}
      </p>
    </div>
  );
}
