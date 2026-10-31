import { badges, earnedBadges } from "../lib/achievements";
import { useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import { Icon } from "./Icon";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** My Library → Badges: milestones earned and those still to come, with progress. */
export function BadgesView() {
  const data = useProfileData();
  const { state } = useStore();
  const list = badges({ readingDays: data.readingDays, readingGoals: data.readingGoals, words: data.words, highlights: activeReading(state).highlights });
  const earned = earnedBadges(list).length;

  return (
    <section aria-labelledby="badges-title">
      <div className="section-head">
        <div>
          <h2 id="badges-title">Badges</h2>
          <p className="muted">
            {earned} of {list.length} earned. They come from what you read, listen to and keep, worked out on this device.
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
                <h3>{b.title}</h3>
                <p className="muted">{b.description}</p>
                {done ? (
                  <p className="badge-when">
                    <Icon name="check" size={14} /> Earned {dateFormat.format(b.earnedAt!)}
                  </p>
                ) : (
                  <>
                    <progress className="badge-progress" max={b.target} value={b.progress} aria-label={`${b.title}: ${b.progress} of ${b.target}`} />
                    <p className="badge-when">
                      {b.progress} of {b.target}
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
