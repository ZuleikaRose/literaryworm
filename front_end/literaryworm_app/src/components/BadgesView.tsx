import { badges, earnedBadges } from "../lib/achievements";
import { useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import { Icon } from "./Icon";
import { dateLocale } from "../lib/i18n";
import { useT } from "../lib/useT";

/** My Library → Badges: milestones earned and those still to come, with progress. */
export function BadgesView() {
  const t = useT();
  // English keeps the device's own date style; other languages write dates their way.
  const dateFormat = new Intl.DateTimeFormat(t.lang === "en" ? undefined : dateLocale(t.lang), { dateStyle: "medium" });
  const data = useProfileData();
  const { state } = useStore();
  const list = badges({ readingDays: data.readingDays, readingGoals: data.readingGoals, words: data.words, highlights: activeReading(state).highlights });
  const earned = earnedBadges(list).length;

  return (
    <section aria-labelledby="badges-title">
      <div className="section-head">
        <div>
          <h2 id="badges-title">{t("Badges")}</h2>
          <p className="muted">
            {t("{earned} of {total} earned. They come from what you read, listen to and keep, worked out on this device.", { earned, total: list.length })}
          </p>
        </div>
      </div>
      <ul className="badge-grid" role="list">
        {list.map((b) => {
          const done = b.earnedAt !== null;
          return (
            <li key={b.id} className={`badge-card${done ? " is-earned" : ""}`}>
              <span className="badge-icon" aria-hidden="true">
                <Icon name={b.icon} size={22} />
              </span>
              <div>
                <h3>{t(b.title)}</h3>
                <p className="muted">{t(b.description)}</p>
                {done ? (
                  <p className="badge-when">
                    <Icon name="check" size={14} /> {t("Earned {date}", { date: dateFormat.format(b.earnedAt!) })}
                  </p>
                ) : (
                  <>
                    <progress className="badge-progress" max={b.target} value={b.progress} aria-label={t("{title}: {progress} of {target}", { title: t(b.title), progress: b.progress, target: b.target })} />
                    <p className="badge-when">
                      {t("{progress} of {target}", { progress: b.progress, target: b.target })}
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
