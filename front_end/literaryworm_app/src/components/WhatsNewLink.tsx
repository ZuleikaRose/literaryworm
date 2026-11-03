import { Link } from "react-router-dom";
import { builtInEntries, sortEntries } from "../lib/changelog";
import { Icon } from "./Icon";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";

// The newest major change in the built-in copy (src/data/changelog.json), so the line shows
// without waiting for the database.
const latest = sortEntries(builtInEntries).find((e) => e.major) ?? sortEntries(builtInEntries)[0];

/** A one-line pointer to What's new (/whats-new), naming the latest major change. */
export function WhatsNewLink() {
  const t = useT();
  return (
    <p className="whats-new-link">
      <Icon name="star" size={16} />
      <span>
        {latest && (
          <>
            {rich(t("Latest: {title}. "), { title: <strong>{latest.title}</strong> })}
          </>
        )}
        {rich(t("{link}: features, fixes and updates."), { link: <Link to="/whats-new">{t("See everything that's new")}</Link> })}
      </span>
    </p>
  );
}
