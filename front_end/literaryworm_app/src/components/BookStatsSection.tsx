import { bookStats, paceText, spentText } from "../lib/bookStats";
import { useBookDays } from "../lib/useBookDays";
import { useT } from "../lib/useT";

const dayText = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * The book page's *Your time with this book* (lib/bookStats.ts): time spent reading and listening,
 * the days, the pace through the book and the biggest days. Private to the profile; shown once
 * there's any time with the book.
 */
export function BookStatsSection({ bookId, at, finished }: { bookId: string; at: number | null; finished: boolean }) {
  const days = useBookDays(bookId);
  const t = useT();
  const stats = days ? bookStats(days, finished ? 1 : at) : null;
  if (!stats) return null;
  const reading = stats.seconds - stats.listened;
  return (
    <section className="book-stats" aria-labelledby="book-stats-title">
      <div className="logs-intro">
        <p className="eyebrow">{t("Only you")}</p>
        <h2 id="book-stats-title">{t("Your time with this book")}</h2>
        <p>{t("Worked out from the minutes this profile read and listened.")}</p>
      </div>
      <div className="book-stats-body">
        <dl className="book-stats-grid">
          <div>
            <dt>{t("Time spent")}</dt>
            <dd>{spentText(stats.seconds)}</dd>
          </div>
          {stats.listened > 0 && reading > 0 && (
            <div>
              <dt>{t("Reading and listening")}</dt>
              <dd>
                {t("{reading} reading, {listening} listening", { reading: spentText(reading), listening: spentText(stats.listened) })}
              </dd>
            </div>
          )}
          <div>
            <dt>{stats.days === 1 ? t("Day") : t("Days")}</dt>
            <dd>
              {stats.days === 1
                ? dayText(stats.first)
                : t("{n} days, {first} to {last}", { n: stats.days, first: dayText(stats.first), last: dayText(stats.last) })}
            </dd>
          </div>
          {stats.perHour !== null && (
            <div>
              <dt>{t("Pace")}</dt>
              <dd>{paceText(stats.perHour)}</dd>
            </div>
          )}
          {stats.leftSeconds !== null && !finished && (
            <div>
              <dt>{t("At that pace")}</dt>
              <dd>{t("About {time} to the end", { time: spentText(stats.leftSeconds) })}</dd>
            </div>
          )}
        </dl>
        {stats.days > 1 && (
          <div>
            <h3 className="book-stats-subtitle">{t("Your biggest days")}</h3>
            <ol className="book-stats-days">
              {stats.topDays.map((d) => (
                <li key={d.day}>
                  <span>{dayText(d.day)}</span>
                  <span>{spentText(d.seconds)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
