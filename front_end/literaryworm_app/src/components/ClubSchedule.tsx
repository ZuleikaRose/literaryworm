import { useId, useState } from "react";
import { clubDate, type Club } from "../lib/clubs";
import { CHAPTERS_PER_WEEK, scheduleStanding, scheduleWeek, scheduleWeeks } from "../lib/clubSchedule";
import { chapterLabel, today } from "../lib/reading";
import { paceTally } from "../lib/clubPace";
import { useClubPace } from "../lib/useClubPace";
import { useClubs } from "../lib/useClubs";
import { useT } from "../lib/useT";
import type { Book } from "../types";

/**
 * *Reading schedule* on a club's page: this week's chapters and where you are against them, and
 * for the owner, how many chapters a week (or none). Every member can vote for a pace; the owner
 * sees the votes and can use one, which starts a new round.
 */
export function ClubSchedule({ club, book, isOwner, mine, me }: { club: Club; book: Book; isOwner: boolean; mine: number; me: string }) {
  const t = useT();
  const clubs = useClubs();
  const id = useId();
  const [perWeek, setPerWeek] = useState<number | null>(club.chaptersPerWeek ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const pace = useClubPace(club.id);
  const [voting, setVoting] = useState(false);

  const chapters = book.chapters.length;
  const week = perWeek ? scheduleWeek(club.startsOn, perWeek, today(), chapters) : null;
  const standing = week && !week.finished ? scheduleStanding(mine, week) : null;

  const choose = async (value: number | null) => {
    const before = perWeek;
    setPerWeek(value);
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      await clubs.setSchedule(club.id, value);
      // A new pace starts a new round of votes.
      if (value !== before) pace.clear();
      setSaved(value ? t("Schedule saved.") : t("Schedule turned off."));
    } catch (err) {
      setPerWeek(before);
      setError(err instanceof Error ? err.message : t("We couldn't save the schedule. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const tally = paceTally(pace.votes ?? {});
  const castVote = async (value: number | null) => {
    setVoting(true);
    setError(null);
    setSaved("");
    try {
      await pace.vote(me, value);
      setSaved(value ? t("Vote saved.") : t("Vote taken back."));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save your vote. Try again."));
    } finally {
      setVoting(false);
    }
  };

  return (
    <section className="goal-card club-schedule" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Reading schedule")}</h2>
      {week &&
        (week.finished ? (
          <p>{t("The schedule has reached the end of the book.")}</p>
        ) : (
          <>
            <p>
              <strong>{t("Week {n} of {total}", { n: week.week, total: scheduleWeeks(perWeek!, chapters) })}</strong>
              {" · "}
              {clubDate(week.startsOn)} – {clubDate(week.endsOn)}
            </p>
            <p>
              {week.from === week.to
                ? t("This week: {chapter}", { chapter: chapterLabel(book, week.from) })
                : t("This week: {from} to {to}", { from: chapterLabel(book, week.from), to: chapterLabel(book, week.to) })}
            </p>
            {standing && (
              <p className={`club-schedule-standing club-schedule-${standing.kind}`}>
                {standing.kind === "onTrack"
                  ? t("You're on track.")
                  : standing.kind === "ahead"
                    ? t.plural(standing.chapters, { one: "You're {count} chapter ahead.", other: "You're {count} chapters ahead." })
                    : t.plural(standing.chapters, { one: "You're {count} chapter behind.", other: "You're {count} chapters behind." })}
              </p>
            )}
          </>
        ))}
      {isOwner && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-per-week`}>
            {t("Chapters a week")}
          </label>
          <select
            id={`${id}-per-week`}
            className="field-input"
            value={perWeek ?? ""}
            disabled={busy}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => void choose(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("No schedule")}</option>
            {CHAPTERS_PER_WEEK.map((n) => (
              <option key={n} value={n}>
                {t.plural(n, { one: "{count} chapter a week", other: "{count} chapters a week" })}
              </option>
            ))}
          </select>
          <p className="field-hint">{t("Counted in weeks from the club's start date.")}</p>
        </div>
      )}
      <div className="club-pace">
        <h3 id={`${id}-pace`}>{t("Vote on the pace")}</h3>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-my-vote`}>
            {t("Your vote")}
          </label>
          <select
            id={`${id}-my-vote`}
            className="field-input"
            value={pace.votes?.[me] ?? ""}
            disabled={voting || pace.votes === null}
            onChange={(e) => void castVote(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("No vote")}</option>
            {CHAPTERS_PER_WEEK.map((n) => (
              <option key={n} value={n}>
                {t.plural(n, { one: "{count} chapter a week", other: "{count} chapters a week" })}
              </option>
            ))}
          </select>
          <p className="field-hint">{isOwner ? t("Members vote; you choose. Using a pace starts a new round of votes.") : t("The club's owner sees the votes and chooses the pace.")}</p>
        </div>
        {pace.error && <p className="goal-hint">{pace.error}</p>}
        {tally.length > 0 ? (
          <ul className="club-pace-tally" aria-labelledby={`${id}-pace`}>
            {tally.map(({ perWeek: n, votes }) => (
              <li key={n}>
                <span>
                  <strong>{t.plural(n, { one: "{count} chapter a week", other: "{count} chapters a week" })}</strong>
                  {" · "}
                  {t.plural(votes, { one: "{count} vote", other: "{count} votes" })}
                  {n === perWeek && ` · ${t("the pace now")}`}
                </span>
                {isOwner && n !== perWeek && (
                  <button type="button" className="secondary-button small-button" disabled={busy} onClick={() => void choose(n)}>
                    {t("Use this pace")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          pace.votes !== null && <p className="field-hint">{t("No votes yet.")}</p>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {saved}
      </p>
    </section>
  );
}
