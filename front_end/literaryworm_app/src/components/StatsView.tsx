import { type CSSProperties, useId, useState } from "react";
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

const MONTHS = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" }).format(Date.UTC(2024, m, 1)));
const MONTHS_LONG = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(Date.UTC(2024, m, 1)));
// 7 January 2024 was a Sunday.
const WEEKDAYS = Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(Date.UTC(2024, 0, 7 + d)));
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * My Library → Stats: a profile's Year in Review. Time read and listened, books finished
 * against the goal, the longest streak, month by month, favourite genres and authors, and the
 * books themselves. Any year with reading can be picked.
 */
export function StatsView({ profile }: { profile: Profile }) {
  const { state } = useStore();
  const { goals, days } = useGoals();
  const current = Number(today().slice(0, 4));
  const years = statsYears(days, current);
  const [year, setYear] = useState(current);
  const yearId = useId();
  const s = yearStats(days, activeReading(state).highlights, year);
  const goal = goals[year] ?? null;
  const peak = Math.max(1, ...s.months.map((m) => m.seconds));

  return (
    <div className="stats">
      <header className="stats-header">
        <div>
          <p className="eyebrow">{profile.name}'s year in review</p>
          <h2>{year} in books</h2>
        </div>
        {years.length > 1 && (
          <div className="stats-year">
            <label className="field-label" htmlFor={yearId}>
              Year
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
      </header>

      {s.seconds === 0 && s.finished === 0 ? (
        <p className="stats-empty">
          Nothing read or listened to in {year} yet. Time counts while the reader is open or the player is playing, and shows here.
        </p>
      ) : (
        <>
          <ul className="stats-tiles" role="list">
            <li>
              <Icon name="clock" size={20} />
              <strong>{readingTime(s.seconds)}</strong>
              <span>reading and listening</span>
            </li>
            <li>
              <Icon name="check" size={20} />
              <strong>{s.finished}</strong>
              <span>
                {s.finished === 1 ? "book" : "books"} finished
                {goal !== null && ` of a goal of ${goal}${s.finished >= goal ? ", goal met" : ""}`}
              </span>
            </li>
            <li>
              <Icon name="bookOpen" size={20} />
              <strong>{s.daysRead}</strong>
              <span>{s.daysRead === 1 ? "day" : "days"} with reading</span>
            </li>
            <li>
              <Icon name="star" size={20} />
              <strong>{s.longestStreak}</strong>
              <span>{s.longestStreak === 1 ? "day" : "days"} in a row, the longest streak</span>
            </li>
            <li>
              <Icon name="highlighter" size={20} />
              <strong>{s.highlights}</strong>
              <span>
                {s.highlights === 1 ? "highlight" : "highlights"}, {s.notes} with a note
              </span>
            </li>
          </ul>

          <section className="stats-card" aria-labelledby="stats-split">
            <h3 id="stats-split">Reading and listening</h3>
            <div className="stats-split" aria-hidden="true">
              <span className="stats-split-read" style={{ "--share": `${percent(s.read, s.seconds)}%` } as CSSProperties} />
              <span className="stats-split-listen" style={{ "--share": `${percent(s.listened, s.seconds)}%` } as CSSProperties} />
            </div>
            <ul className="stats-legend" role="list">
              <li>
                <span className="swatch read" aria-hidden="true" /> Reading: {readingTime(s.read)} ({percent(s.read, s.seconds)}%)
              </li>
              <li>
                <span className="swatch listen" aria-hidden="true" /> Listening: {readingTime(s.listened)} ({percent(s.listened, s.seconds)}%)
              </li>
            </ul>
          </section>

          <section className="stats-card" aria-labelledby="stats-months">
            <h3 id="stats-months">Month by month</h3>
            <ol className="stats-months" role="list">
              {s.months.map((m) => (
                <li key={m.month}>
                  <span className="stats-bar" aria-hidden="true" style={{ "--height": `${(m.seconds / peak) * 100}%` } as CSSProperties}>
                    <span className="stats-bar-listen" style={{ "--height": `${percent(m.listened, m.seconds)}%` } as CSSProperties} />
                  </span>
                  <span className="stats-month-name">
                    <span aria-hidden="true">{MONTHS[m.month]}</span>
                    <span className="visually-hidden">
                      {MONTHS_LONG[m.month]}: {readingTime(m.seconds)}
                      {m.listened > 0 && `, ${readingTime(m.listened)} of it listening`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="goal-hint">
              {s.busiestMonth !== null && (
                <>
                  Busiest month: <strong>{MONTHS_LONG[s.busiestMonth]}</strong> ({readingTime(s.months[s.busiestMonth].seconds)}).{" "}
                </>
              )}
              {s.favouriteWeekday !== null && (
                <>
                  Favourite day to read: <strong>{WEEKDAYS[s.favouriteWeekday]}</strong>.
                </>
              )}
            </p>
          </section>

          {(s.genres.length > 0 || s.authors.length > 0) && (
            <div className="stats-pair">
              {s.genres.length > 0 && (
                <section className="stats-card" aria-labelledby="stats-genres">
                  <h3 id="stats-genres">Top genres</h3>
                  <ol className="stats-rank">
                    {s.genres.map((g) => (
                      <li key={g.name}>
                        <span>{g.name}</span>
                        <span>
                          {g.count} {g.count === 1 ? "book" : "books"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {s.authors.length > 0 && (
                <section className="stats-card" aria-labelledby="stats-authors">
                  <h3 id="stats-authors">Top authors</h3>
                  <ol className="stats-rank">
                    {s.authors.map((a) => (
                      <li key={a.name}>
                        <span>{a.name}</span>
                        <span>
                          {a.count} {a.count === 1 ? "book" : "books"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}

          {s.books.some((b) => b.book) && (
            <section className="stats-card" aria-labelledby="stats-books">
              <h3 id="stats-books">Books you finished</h3>
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
                <p className="goal-hint">Books marked finished before LiteraryWorm kept their names are counted but not listed.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
