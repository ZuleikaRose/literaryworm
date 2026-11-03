import { type CSSProperties, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { readingTime } from "../lib/goals";
import { today } from "../lib/reading";
import { statsYears, yearStats } from "../lib/stats";
import { useGoals } from "../lib/useGoals";
import { activeReading } from "../store/reducer";
import { useStore } from "../store/context";
import type { Profile } from "../types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { YearCardDialog } from "./YearCardDialog";
import { YearStoryDialog } from "./YearStoryDialog";
import { dateLocale, rich } from "../lib/i18n";
import { useT } from "../lib/useT";

// Month and weekday names: the device's own in English, the chosen language's otherwise.
function calendarNames(locale: string | undefined) {
  const format = (options: Intl.DateTimeFormatOptions, date: number) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
  return {
    months: Array.from({ length: 12 }, (_, m) => format({ month: "short" }, Date.UTC(2024, m, 1))),
    monthsLong: Array.from({ length: 12 }, (_, m) => format({ month: "long" }, Date.UTC(2024, m, 1))),
    // 7 January 2024 was a Sunday.
    weekdays: Array.from({ length: 7 }, (_, d) => format({ weekday: "long" }, Date.UTC(2024, 0, 7 + d))),
  };
}
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * My Library → Stats: a profile's Year in Review. Time read and listened, books finished
 * against the goal, the longest streak, month by month, favourite genres and authors, and the
 * books themselves. Any year with reading can be picked.
 */
export function StatsView({ profile }: { profile: Profile }) {
  const t = useT();
  const { months: MONTHS, monthsLong: MONTHS_LONG, weekdays: WEEKDAYS } = useMemo(() => calendarNames(t.lang === "en" ? undefined : dateLocale(t.lang)), [t.lang]);
  const { state } = useStore();
  const { goals, days } = useGoals();
  const current = Number(today().slice(0, 4));
  const years = statsYears(days, current);
  const [year, setYear] = useState(current);
  const yearId = useId();
  const highlights = activeReading(state).highlights;
  // Kept between renders so the share card isn't redrawn for nothing.
  const s = useMemo(() => yearStats(days, highlights, year), [days, highlights, year]);
  const [story, setStory] = useState(false);
  const [sharing, setSharing] = useState(false);
  const hasReading = s.seconds > 0 || s.finished > 0;
  const goal = goals[year] ?? null;
  const peak = Math.max(1, ...s.months.map((m) => m.seconds));

  return (
    <div className="stats">
      <header className="stats-header">
        <div>
          <p className="eyebrow">{t("{name}'s year in review", { name: profile.name })}</p>
          <h2>{t("{year} in books", { year })}</h2>
        </div>
        <div className="stats-header-actions">
          {hasReading && (
            <button type="button" className="secondary-button small-button" onClick={() => setSharing(true)}>
              <Icon name="share" size={16} /> {t("Share as a picture")}
            </button>
          )}
          {hasReading && (
            <button type="button" className="secondary-button small-button" onClick={() => setStory(true)}>
              <Icon name="play" size={16} /> {t("Play as a story")}
            </button>
          )}
        {years.length > 1 && (
          <div className="stats-year">
            <label className="field-label" htmlFor={yearId}>
              {t("Year")}
            </label>
            <select id={yearId} className="field-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
        </div>
      </header>
      <YearCardDialog open={sharing} onClose={() => setSharing(false)} name={profile.name} stats={s} goal={goal} />
      <YearStoryDialog open={story} onClose={() => setStory(false)} name={profile.name} stats={s} goal={goal} />

      {!hasReading ? (
        <p className="stats-empty">
          {t("Nothing read or listened to in {year} yet. Time counts while the reader is open or the player is playing, and shows here.", { year })}
        </p>
      ) : (
        <>
          <ul className="stats-tiles" role="list">
            <li>
              <Icon name="clock" size={20} />
              <strong>{readingTime(s.seconds)}</strong>
              <span>{t("reading and listening")}</span>
            </li>
            <li>
              <Icon name="check" size={20} />
              <strong>{s.finished}</strong>
              <span>
                {goal === null
                  ? t.plural(s.finished, { one: "book finished", other: "books finished" })
                  : s.finished >= goal
                    ? t.plural(s.finished, { one: "book finished of a goal of {goal}, goal met", other: "books finished of a goal of {goal}, goal met" }, { goal })
                    : t.plural(s.finished, { one: "book finished of a goal of {goal}", other: "books finished of a goal of {goal}" }, { goal })}
              </span>
            </li>
            <li>
              <Icon name="bookOpen" size={20} />
              <strong>{s.daysRead}</strong>
              <span>{t.plural(s.daysRead, { one: "day with reading", other: "days with reading" })}</span>
            </li>
            <li>
              <Icon name="star" size={20} />
              <strong>{s.longestStreak}</strong>
              <span>{t.plural(s.longestStreak, { one: "day in a row, the longest streak", other: "days in a row, the longest streak" })}</span>
            </li>
            <li>
              <Icon name="highlighter" size={20} />
              <strong>{s.highlights}</strong>
              <span>{t.plural(s.highlights, { one: "highlight, {notes} with a note", other: "highlights, {notes} with a note" }, { notes: s.notes })}</span>
            </li>
          </ul>

          <section className="stats-card" aria-labelledby="stats-split">
            <h3 id="stats-split">{t("Reading and listening")}</h3>
            <div className="stats-split" aria-hidden="true">
              <span className="stats-split-read" style={{ "--share": `${percent(s.read, s.seconds)}%` } as CSSProperties} />
              <span className="stats-split-listen" style={{ "--share": `${percent(s.listened, s.seconds)}%` } as CSSProperties} />
            </div>
            <ul className="stats-legend" role="list">
              <li>
                <span className="swatch read" aria-hidden="true" /> {t("Reading: {time} ({percent}%)", { time: readingTime(s.read), percent: percent(s.read, s.seconds) })}
              </li>
              <li>
                <span className="swatch listen" aria-hidden="true" /> {t("Listening: {time} ({percent}%)", { time: readingTime(s.listened), percent: percent(s.listened, s.seconds) })}
              </li>
            </ul>
          </section>

          <section className="stats-card" aria-labelledby="stats-months">
            <h3 id="stats-months">{t("Month by month")}</h3>
            <ol className="stats-months" role="list">
              {s.months.map((m) => (
                <li key={m.month}>
                  <span className="stats-bar" aria-hidden="true" style={{ "--height": `${(m.seconds / peak) * 100}%` } as CSSProperties}>
                    <span className="stats-bar-listen" style={{ "--height": `${percent(m.listened, m.seconds)}%` } as CSSProperties} />
                  </span>
                  <span className="stats-month-name">
                    <span aria-hidden="true">{MONTHS[m.month]}</span>
                    <span className="visually-hidden">
                      {m.listened > 0
                        ? t("{month}: {time}, {listened} of it listening", { month: MONTHS_LONG[m.month], time: readingTime(m.seconds), listened: readingTime(m.listened) })
                        : t("{month}: {time}", { month: MONTHS_LONG[m.month], time: readingTime(m.seconds) })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="goal-hint">
              {s.busiestMonth !== null && (
                <>
                  {rich(t("Busiest month: {month} ({time})."), { month: <strong>{MONTHS_LONG[s.busiestMonth]}</strong>, time: readingTime(s.months[s.busiestMonth].seconds) })}{" "}
                </>
              )}
              {s.favouriteWeekday !== null && (
                <>
                  {rich(t("Favourite day to read: {day}."), { day: <strong>{WEEKDAYS[s.favouriteWeekday]}</strong> })}
                </>
              )}
            </p>
          </section>

          {(s.genres.length > 0 || s.authors.length > 0) && (
            <div className="stats-pair">
              {s.genres.length > 0 && (
                <section className="stats-card" aria-labelledby="stats-genres">
                  <h3 id="stats-genres">{t("Top genres")}</h3>
                  <ol className="stats-rank">
                    {s.genres.map((g) => (
                      <li key={g.name}>
                        <span>{g.name}</span>
                        <span>{t.plural(g.count, { one: "{count} book", other: "{count} books" })}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {s.authors.length > 0 && (
                <section className="stats-card" aria-labelledby="stats-authors">
                  <h3 id="stats-authors">{t("Top authors")}</h3>
                  <ol className="stats-rank">
                    {s.authors.map((a) => (
                      <li key={a.name}>
                        <span>{a.name}</span>
                        <span>{t.plural(a.count, { one: "{count} book", other: "{count} books" })}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}

          {s.books.some((b) => b.book) && (
            <section className="stats-card" aria-labelledby="stats-books">
              <h3 id="stats-books">{t("Books you finished")}</h3>
              <ul className="stats-books" role="list">
                {s.books.map(
                  ({ id, book, day }) =>
                    book && (
                      <li key={`${id}-${day}`}>
                        <Link to={`/books/${id}`}>
                          <Cover book={book} size="sm" />
                          <span>
                            <strong>{book.title}</strong>
                            <small>{book.author}</small>
                          </span>
                        </Link>
                      </li>
                    ),
                )}
              </ul>
              {s.finished > s.books.filter((b) => b.book).length && (
                <p className="goal-hint">{t("Books marked finished before LiteraryWorm kept their names are counted but not listed.")}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
