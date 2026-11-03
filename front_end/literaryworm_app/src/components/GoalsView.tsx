import { ReadingSprint } from "./ReadingSprint";
import { type FormEvent, useState } from "react";
import { weeklyGoal } from "../lib/kidsReport";
import { weeklyGoalOptions } from "../lib/profiles";
import { booksFinishedIn, durationLabel, expectedByNow, GOAL_MAX, GOAL_MIN, monthSummaries, readingTime, REST_DAYS_PER_MONTH, streaks } from "../lib/goals";
import { rich, type UiLanguage } from "../lib/i18n";
import { useT } from "../lib/useT";
import { today } from "../lib/reading";
import { useGoals } from "../lib/useGoals";
import type { Profile } from "../types";
import { ChallengesView } from "./ChallengesView";
import { Field } from "./Field";
import { Icon } from "./Icon";

// The browser's own date style in English; the chosen language's otherwise.
const formatLocale = (lang: UiLanguage) => (lang === "en" ? undefined : lang);
/** "Sat 25 Oct" for a YYYY-MM-DD day. */
const restDay = (day: string, lang: UiLanguage) =>
  new Intl.DateTimeFormat(formatLocale(lang), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

const monthName = (lang: UiLanguage) => new Intl.DateTimeFormat(formatLocale(lang), { month: "long", year: "numeric", timeZone: "UTC" });

/** My Library → Goals: the profile's yearly book goal, reading streak, household challenges and the last six months. */
export function GoalsView({ profile }: { profile: Profile }) {
  const t = useT();
  const { goals, days, setGoal, setWeeklyGoal } = useGoals();
  const now = today();
  const year = Number(now.slice(0, 4));
  const goal = goals[year] ?? null;
  const done = booksFinishedIn(days, year);
  const { current, longest, restDays, restLeft } = streaks(days, now);
  const months = monthSummaries(days, now);
  const [editing, setEditing] = useState(false);
  const week = weeklyGoal(days, profile.weeklyGoalMinutes, now);

  return (
    <div className="goals">
      {profile.ageRating === "kids" ? (
        week && (
          <section className="goal-card" aria-labelledby="weekly-goal-title">
            <h2 id="weekly-goal-title">{t("Weekly goal")}</h2>
            <WeeklyProgress minutes={week.minutes} goal={week.goal} />
            <p className="goal-hint">
              {week.reached ? t("You did it! Goal reached.") : t("{time} to go.", { time: readingTime(week.left * 60) })}{" "}
              {t("A grown-up set this goal; it counts the last 7 days.")}
            </p>
          </section>
        )
      ) : (
        <WeeklyGoalCard key={profile.id} current={profile.weeklyGoalMinutes} week={week} onSave={setWeeklyGoal} />
      )}
      <section className="goal-card" aria-labelledby="goal-title">
        <h2 id="goal-title">{t("{year} reading goal", { year })}</h2>
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
        <h2 id="streak-title">{t("Reading streak")}</h2>
        <p className="streak-number">
          <Icon name="clock" size={22} />
          {rich(t.plural(current, { one: "{number} day in a row", other: "{number} days in a row" }), { number: <strong>{current}</strong> })}
        </p>
        <p className="goal-hint">
          {current === 0 ? t("Read or listen for a minute today to start a streak.") : t("Read or listen for a minute a day to keep it going.")}{" "}
          {t.plural(longest, { one: "Longest: {count} day.", other: "Longest: {count} days." })}
        </p>
        <p className="goal-hint streak-rest">
          <Icon name="moon" size={16} />
          <span>
            {restLeft === 0
              ? t("No rest days left this month: miss a day and the streak starts again.")
              : t.plural(restLeft, { one: "{count} rest day left this month.", other: "{count} rest days left this month." })}{" "}
            {t("A missed day uses one, so the streak keeps going ({n} a month).", { n: REST_DAYS_PER_MONTH })}
            {restDays.length > 0 && ` ${t("This streak rested on {days}.", { days: restDays.map((d) => restDay(d, t.lang)).join(", ") })}`}
          </span>
        </p>
      </section>

      <ChallengesView profile={profile} />

      <ReadingSprint scope={{ kind: "household" }} readPath="/library?status=reading" />

      <section className="goal-months" aria-labelledby="months-title">
        <h2 id="months-title">{t("Month by month")}</h2>
        <div className="goal-table-wrap">
          <table className="goal-table">
            <thead>
              <tr>
                <th scope="col">{t("Month")}</th>
                <th scope="col">{t("Time")}</th>
                <th scope="col">{t("Days read")}</th>
                <th scope="col">{t("Books finished")}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthName(t.lang).format(new Date(`${m.month}-01T00:00:00Z`))}</th>
                  <td>{readingTime(m.seconds)}</td>
                  <td>{m.daysRead}</td>
                  <td>{m.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="goal-hint">{t("Time counts while the reader is open or the player is playing, on every device this profile uses.")}</p>
      </section>
    </div>
  );
}

function WeeklyProgress({ minutes, goal }: { minutes: number; goal: number }) {
  const t = useT();
  const label = t("{done} of {goal} this week", { done: readingTime(minutes * 60), goal: readingTime(goal * 60) });
  return (
    <>
      <p className="goal-count">
        {rich(t("{done} of {goal} this week", { goal: readingTime(goal * 60) }), { done: <strong>{readingTime(minutes * 60)}</strong> })}
      </p>
      <progress className="goal-bar" max={goal} value={Math.min(minutes, goal)} aria-label={label} />
    </>
  );
}

/** A grown-up or teen profile's own weekly goal: progress, or a choice of goal. */
function WeeklyGoalCard({
  current,
  week,
  onSave,
}: {
  current: number | null;
  week: ReturnType<typeof weeklyGoal>;
  onSave: (minutes: number | null) => Promise<void>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current !== null ? String(current) : "120");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (minutes: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(minutes);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save your weekly goal. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="goal-card" aria-labelledby="weekly-goal-title">
      <h2 id="weekly-goal-title">{t("Weekly goal")}</h2>
      {week && !editing ? (
        <>
          <WeeklyProgress minutes={week.minutes} goal={week.goal} />
          <p className="goal-hint">
            {week.reached ? t("Goal reached. Well done!") : t("{time} to go.", { time: readingTime(week.left * 60) })} {t("It counts the last 7 days.")}
          </p>
          <div className="goal-actions">
            <button type="button" className="ghost-button small-button" onClick={() => setEditing(true)}>
              <Icon name="edit" size={15} /> {t("Change goal")}
            </button>
            <button type="button" className="ghost-button small-button" disabled={busy} onClick={() => void save(null)}>
              <Icon name="trash" size={15} /> {t("Remove goal")}
            </button>
          </div>
        </>
      ) : (
        <form
          className="goal-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(Number(value));
          }}
        >
          <p className="goal-hint">{t("How much would you like to read or listen each week? It counts the last 7 days, on every device.")}</p>
          <div className="field">
            <label className="field-label" htmlFor="own-weekly-goal">
              {t("Weekly reading goal")}
            </label>
            <select id="own-weekly-goal" className="field-input" value={value} onChange={(e) => setValue(e.target.value)}>
              {weeklyGoalOptions
                .filter((o) => o.value !== null)
                .map((o) => (
                  <option key={o.value} value={o.value!}>
                    {t("{duration} a week", { duration: durationLabel(o.value!) })}
                  </option>
                ))}
            </select>
          </div>
          <div className="goal-actions">
            <button type="submit" className="primary-button small-button" disabled={busy}>
              {busy ? t("Saving…") : t("Save weekly goal")}
            </button>
            {week && (
              <button type="button" className="ghost-button small-button" onClick={() => setEditing(false)}>
                {t("Cancel")}
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}

function GoalProgress({ goal, done, now, onEdit, onRemove }: { goal: number; done: number; now: string; onEdit: () => void; onRemove: () => Promise<void> }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expected = expectedByNow(goal, now);
  const ahead = Math.round(done - expected);
  const pace =
    done >= goal
      ? t("Goal reached. Well done!")
      : ahead > 0
        ? t.plural(ahead, { one: "{count} book ahead of pace.", other: "{count} books ahead of pace." })
        : ahead < 0
          ? t.plural(-ahead, { one: "{count} book behind pace.", other: "{count} books behind pace." })
          : t("Right on pace.");
  return (
    <>
      <p className="goal-count">
        {rich(t.plural(goal, { one: "{done} of {count} book finished", other: "{done} of {count} books finished" }), { done: <strong>{done}</strong> })}
      </p>
      <progress className="goal-bar" max={goal} value={Math.min(done, goal)} aria-label={t("{done} of {goal} books finished", { done, goal })} />
      <p className="goal-hint">{pace}</p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="goal-actions">
        <button type="button" className="ghost-button small-button" onClick={onEdit}>
          <Icon name="edit" size={15} /> {t("Change goal")}
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
              setError(err instanceof Error ? err.message : t("We couldn't remove the goal. Try again."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="trash" size={15} /> {t("Remove goal")}
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
  const t = useT();
  const [value, setValue] = useState(initial !== null ? String(initial) : "12");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const books = Number(value);
    if (!Number.isInteger(books) || books < GOAL_MIN || books > GOAL_MAX) {
      setError(t("Enter a whole number from {min} to {max}.", { min: GOAL_MIN, max: GOAL_MAX }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(books);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save your goal. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="goal-form" onSubmit={submit} noValidate>
      <p className="goal-hint">{t("How many books would {name} like to finish in {year}? Finishing a book in the reader or player, or marking it Finished, counts.", { name, year })}</p>
      <Field
        label={t("Books to finish in {year}", { year })}
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
          {busy ? t("Saving…") : t("Save goal")}
        </button>
        {onCancel && (
          <button type="button" className="ghost-button small-button" onClick={onCancel}>
            {t("Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
