import { Link } from "react-router-dom";
import { builtInEntries, sortEntries } from "../lib/changelog";
import { Icon } from "./Icon";

// The newest major change in the built-in copy (src/data/changelog.json), so the line shows
// without waiting for the database.
const latest = sortEntries(builtInEntries).find((e) => e.major) ?? sortEntries(builtInEntries)[0];

/** A one-line pointer to What's new (/whats-new), naming the latest major change. */
export function WhatsNewLink() {
  return (
    <p className="whats-new-link">
      <Icon name="star" size={16} />
      <span>
        {latest && (
          <>
            Latest: <strong>{latest.title}</strong>.{" "}
          </>
        )}
        <Link to="/whats-new">See everything that's new</Link>: features, fixes and updates.
      </span>
    </p>
  );
}
