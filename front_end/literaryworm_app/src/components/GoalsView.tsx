import { type FormEvent, useState } from "react";
import { booksFinishedIn, expectedByNow, GOAL_MAX, GOAL_MIN, monthSummaries, readingTime, streaks } from "../lib/goals";
import { today } from "../lib/reading";
import { useGoals } from "../lib/useGoals";
import type { Profile } from "../types";
import { ChallengesView } from "./ChallengesView";
import { Field } from "./Field";
import { Icon } from "./Icon";

const monthName = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

/** My Library → Goals: the profile's yearly book goal, reading streak, household challenges and the last six months. */
export function GoalsView({ profile }: { profile: Profile }) {
  const { goals, days, setGoal } = useGoals();
  const now = today();
  const year = Number(now.slice(0, 4));
  const goal = goals[year] ?? null;
  const done = booksFinishedIn(days, year);
  const { current, longest } = streaks(days, now);
  const months = monthSummaries(days, now);
  const [editing, setEditing] = useState(false);

  return (
    <div className="goals">
      <section className="goal-card" aria-labelledby="goal-title">
        <h2 id="goal-title">{year} reading goal</h2>
        {goal !== null && !editing ? (
          <GoalProgress goal={goal} done={done} now={now} onEdit={() => setEditing(true)} onRemove={() => setGoal(year, null)} />
        ) : (
          <GoalForm
            initial={goal}
            year={year}
            name={profile.name}
            onSave={async (books) => {
              await setGoal(year, books);
              setEditing(false);
            }}
            onCancel={goal !== null ? () => setEditing(false) : undefined}
          />
        )}
      </section>

      <section className="goal-card streak-card" aria-labelledby="streak-title">
        <h2 id="streak-title">Reading streak</h2>
        <p className="streak-number">
          <Icon name="clock" size={22} />
          <strong>{current}</strong> {current === 1 ? "day" : "days"} in a row
        </p>
        <p className="goal-hint">
          {current === 0 ? "Read or listen for a minute today to start a streak." : "Read or listen for a minute a day to keep it going."} Longest:{" "}
          {longest} {longest === 1 ? "day" : "days"}.
        </p>
      </section>

      <ChallengesView profile={profile} />

      <section className="goal-months" aria-labelledby="months-title">
        <h2 id="months-title">Month by month</h2>
        <div className="goal-table-wrap">
          <table className="goal-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Time</th>
                <th scope="col">Days read</th>
                <th scope="col">Books finished</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthName.format(new Date(`${m.month}-01T00:00:00Z`))}</th>
                  <td>{readingTime(m.seconds)}</td>
                  <td>{m.daysRead}</td>
                  <td>{m.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="goal-hint">Time counts while the reader is open or the player is playing, on every device this profile uses.</p>
      </section>
    </div>
  );
}

function GoalProgress({ goal, done, now, onEdit, onRemove }: { goal: number; done: number; now: string; onEdit: () => void; onRemove: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expected = expectedByNow(goal, now);
  const ahead = Math.round(done - expected);
  const pace =
    done >= goal
      ? "Goal reached. Well done!"
      : ahead > 0
        ? `${ahead} ${ahead === 1 ? "book" : "books"} ahead of pace.`
        : ahead < 0
          ? `${-ahead} ${ahead === -1 ? "book" : "books"} behind pace.`
          : "Right on pace.";
  return (
    <>
      <p className="goal-count">
        <strong>{done}</strong> of {goal} {goal === 1 ? "book" : "books"} finished
      </p>
      <progress className="goal-bar" max={goal} value={Math.min(done, goal)} aria-label={`${done} of ${goal} books finished`} />
      <p className="goal-hint">{pace}</p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="goal-actions">
        <button type="button" className="ghost-button small-button" onClick={onEdit}>
          <Icon name="edit" size={15} /> Change goal
        </button>
        <button
          type="button"
          className="ghost-button small-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onRemove();
            } catch (err) {
              setError(err instanceof Error ? err.message : "We couldn't remove the goal. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="trash" size={15} /> Remove goal
        </button>
      </div>
    </>
  );
}

function GoalForm({
  initial,
  year,
  name,
  onSave,
  onCancel,
}: {
  initial: number | null;
  year: number;
  name: string;
  onSave: (books: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial !== null ? String(initial) : "12");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const books = Number(value);
    if (!Number.isInteger(books) || books < GOAL_MIN || books > GOAL_MAX) {
      setError(`Enter a whole number from ${GOAL_MIN} to ${GOAL_MAX}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(books);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your goal. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="goal-form" onSubmit={submit} noValidate>
      <p className="goal-hint">How many books would {name} like to finish in {year}? Finishing a book in the reader or player, or marking it Finished, counts.</p>
      <Field
        label={`Books to finish in ${year}`}
        type="number"
        inputMode="numeric"
        min={GOAL_MIN}
        max={GOAL_MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error ?? undefined}
      />
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Saving…" : "Save goal"}
        </button>
        {onCancel && (
          <button type="button" className="ghost-button small-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
