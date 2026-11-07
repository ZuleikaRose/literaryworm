import { useId, useState } from "react";
import { clubDate, type Club } from "../lib/clubs";
import { CHAPTERS_PER_WEEK, scheduleStanding, scheduleWeek, scheduleWeeks } from "../lib/clubSchedule";
import { chapterLabel, today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { useT } from "../lib/useT";
import type { Book } from "../types";

/**
 * *Reading schedule* on a club's page: this week's chapters and where you are against them, and
 * for the owner, how many chapters a week (or none).
 */
export function ClubSchedule({ club, book, isOwner, mine }: { club: Club; book: Book; isOwner: boolean; mine: number }) {
  const t = useT();
  const clubs = useClubs();
  const id = useId();
  const [perWeek, setPerWeek] = useState<number | null>(club.chaptersPerWeek ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  if (!perWeek && !isOwner) return null;

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
      setSaved(value ? t("Schedule saved.") : t("Schedule turned off."));
    } catch (err) {
      setPerWeek(before);
      setError(err instanceof Error ? err.message : t("We couldn't save the schedule. Try again."));
    } finally {
      setBusy(false);
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
