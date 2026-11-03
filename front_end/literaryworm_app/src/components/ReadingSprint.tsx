import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { clock, DEFAULT_SPRINT_MINUTES, isSprintMinutes, rankReaders, secondsLeft, SPRINT_MINUTES, type SprintScope, totalPages } from "../lib/sprints";
import { useReadingSprint } from "../lib/useReadingSprint";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * A reading sprint card, for the household (Goals) or a book club (its page): start one, join the
 * one running, watch the shared timer, and see everyone's pages when it ends.
 */
export function ReadingSprint({ scope, readPath }: { scope: SprintScope; readPath: string }) {
  const t = useT();
  const lengthId = useId();
  const { sprint, readers, loaded, error, busy, now, running, joined, myPages, start, join } = useReadingSprint(scope);
  const [minutes, setMinutes] = useState<number>(DEFAULT_SPRINT_MINUTES);
  const ranked = rankReaders(readers);
  const ended = Boolean(sprint && !running);

  return (
    <section className="goal-card sprint-card" aria-labelledby={`${lengthId}-title`}>
      <h2 id={`${lengthId}-title`}>
        <Icon name="clock" size={18} /> {t("Reading sprint")}
      </h2>
      <p className="goal-hint">
        {scope.kind === "club"
          ? t("Read together for 15 to 30 minutes. Everyone sees the timer, and the pages each of you turned when it ends.")
          : t("Read together at home for 15 to 30 minutes, on any of your devices. Pages turned in the reader are counted when it ends.")}
      </p>

      {!loaded ? (
        <p className="goal-hint">{t("Loading…")}</p>
      ) : running && sprint ? (
        <div className="sprint-live">
          <p className="sprint-clock" role="timer" aria-label={t("Time left in the sprint")}>
            {clock(secondsLeft(sprint, now))}
          </p>
          <p className="goal-hint">{t.plural(readers.length, { one: "{count} reader in this sprint.", other: "{count} readers in this sprint." })}</p>
          {joined ? (
            <>
              <p className="sprint-mine">
                {myPages !== null
                  ? t.plural(myPages, { one: "You've read {count} page so far on this device.", other: "You've read {count} pages so far on this device." })
                  : t("You're in. Pages count on the device you read on.")}
              </p>
              <Link className="primary-button small-button" to={readPath}>
                <Icon name="bookOpen" size={15} /> {t("Read now")}
              </Link>
            </>
          ) : (
            <button type="button" className="primary-button small-button" disabled={busy} onClick={() => void join()}>
              {busy ? t("Joining…") : t("Join the sprint")}
            </button>
          )}
          <ul className="sprint-readers" role="list">
            {ranked.map((r) => (
              <li key={r.profileId}>{r.mine && scope.kind === "club" ? t("{name} (you)", { name: r.name }) : r.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="sprint-start">
          {ended && sprint && ranked.length > 0 && (
            <div className="sprint-results">
              <h3>{t("Last sprint: {minutes} minutes", { minutes: sprint.minutes })}</h3>
              <ol role="list">
                {ranked.map((r) => (
                  <li key={r.profileId}>
                    <span>{r.mine && scope.kind === "club" ? t("{name} (you)", { name: r.name }) : r.name}</span>
                    <strong>{r.pages === null ? t("not saved") : t.plural(r.pages, { one: "{count} page", other: "{count} pages" })}</strong>
                  </li>
                ))}
              </ol>
              <p className="goal-hint">{t.plural(totalPages(readers), { one: "{count} page between you.", other: "{count} pages between you." })}</p>
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor={lengthId}>
              {t("Length")}
            </label>
            <select id={lengthId} className="field-input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {SPRINT_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {t("{n} minutes", { n: m })}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="primary-button small-button" disabled={busy || !isSprintMinutes(minutes)} onClick={() => void start(minutes)}>
            {busy ? t("Starting…") : t("Start a sprint")}
          </button>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}
