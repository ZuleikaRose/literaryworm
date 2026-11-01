import { useId, useState } from "react";
import { bookStats } from "../lib/bookStats";
import { dailyText, planDateError, planToday, statusText } from "../lib/readingPlans";
import { today } from "../lib/reading";
import { useBookDays } from "../lib/useBookDays";
import { useReadingPlans } from "../lib/useReadingPlans";
import { useProfileData } from "../store/context";
import { Icon } from "./Icon";

const longDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });

/**
 * *Reading plan* on a book's page (lib/readingPlans.ts): choose a day to finish by, and see each
 * day's share (minutes at this profile's pace, and pages), and whether it's ahead or behind.
 * Changing the date starts the plan again from where the reader is now.
 */
export function ReadingPlanSection({ bookId, title, pages, at, finished }: { bookId: string; title: string; pages: number | null; at: number; finished: boolean }) {
  const reading = useReadingPlans();
  const days = useBookDays(bookId);
  const { readingWpm } = useProfileData();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (reading.plans === null) return null;

  const now = today();
  const plan = reading.plans.find((p) => p.bookId === bookId);
  const perHour = days ? (bookStats(days, at)?.perHour ?? null) : null;
  const t = plan ? planToday(plan, { pages: pages ?? 0 }, finished ? 1 : at, now, perHour, readingWpm) : null;
  if (finished && !plan) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = planDateError(date, now);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await reading.save({ bookId, finishBy: date, startFraction: Math.min(1, Math.max(0, at)), startedOn: now });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save the plan. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await reading.remove(bookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't remove the plan. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="reading-plan-form" onSubmit={save} noValidate>
      <label htmlFor={`${id}-date`}>Finish by</label>
      <div className="reading-plan-row">
        <input
          id={`${id}-date`}
          type="date"
          min={now}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
        <button type="submit" className="primary-button" disabled={busy}>
          {plan ? "Save the date" : "Make a plan"}
        </button>
        {plan && (
          <button type="button" className="text-button" onClick={() => (setEditing(false), setError(null))}>
            Cancel
          </button>
        )}
      </div>
      <p className="field-hint" id={`${id}-hint`}>
        We'll work out a day's reading from where you are, at your own pace.
      </p>
    </form>
  );

  return (
    <section className="reading-plan" aria-labelledby={`${id}-title`}>
      <div className="logs-intro">
        <p className="eyebrow">Only you</p>
        <h2 id={`${id}-title`}>Reading plan</h2>
        <p>Pick a day to finish {title} by, and see how much a day gets you there.</p>
      </div>
      <div className="reading-plan-body">
        {plan && t && !editing ? (
          <>
            <dl className="book-stats-grid">
              <div>
                <dt>Finish by</dt>
                <dd>
                  {longDay(plan.finishBy)}
                  {t.daysLeft > 0 && t.status !== "done" && ` (${t.daysLeft === 1 ? "today is the last day" : `${t.daysLeft} days left`})`}
                </dd>
              </div>
              {t.status !== "done" && (
                <div>
                  <dt>Each day</dt>
                  <dd>{dailyText(t)}</dd>
                </div>
              )}
              <div>
                <dt>How it's going</dt>
                <dd className={`plan-status plan-${t.status}`}>{statusText(t)}</dd>
              </div>
            </dl>
            <div className="reading-plan-actions">
              <button type="button" className="secondary-button" onClick={() => (setDate(plan.finishBy), setEditing(true))}>
                <Icon name="calendar" size={16} /> Change the date
              </button>
              <button type="button" className="text-button danger-text" disabled={busy} onClick={remove}>
                Remove the plan
              </button>
            </div>
          </>
        ) : (
          form
        )}
        {error && (
          <p className="field-error" id={`${id}-error`} role="alert">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
        {reading.error && <p className="muted">{reading.error}</p>}
      </div>
    </section>
  );
}
