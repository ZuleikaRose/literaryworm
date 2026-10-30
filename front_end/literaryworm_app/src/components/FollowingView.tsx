import { useState } from "react";
import { Link } from "react-router-dom";
import { catalogBy, type PersonKind, personInitials, personPath } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import type { Follow, Profile } from "../types";
import { FollowButton } from "./FollowButton";

const GROUPS: { kind: PersonKind; title: string }[] = [
  { kind: "author", title: "Authors" },
  { kind: "narrator", title: "Narrators" },
];

const sameFollow = (a: Follow, b: Follow) => a.kind === b.kind && a.name === b.name;

/** My Library → Following: the authors and narrators the profile follows, with their pages and Unfollow. */
export function FollowingView({ profile }: { profile: Profile }) {
  const { follows } = useFollows();
  // Someone unfollowed here stays in the list (with Follow) until the page is left, so a slip is easy to undo.
  const [seen, setSeen] = useState<Follow[]>(follows);
  const added = follows.filter((f) => !seen.some((s) => sameFollow(s, f)));
  if (added.length) setSeen([...seen, ...added]);
  const shown = [...seen, ...added];

  if (shown.length === 0) {
    return (
      <div className="library-empty">
        <h2>You don't follow anyone yet</h2>
        <p>
          Follow an author or narrator from their page, or from an author search, to see their new books first on Home
          {profile.ageRating === "kids" ? "" : " and in a weekly email"}.
        </p>
        <Link className="primary-button" to="/search?by=author">
          Search by author
        </Link>
      </div>
    );
  }

  return (
    <div className="following-view">
      {GROUPS.map(({ kind, title }) => {
        const people = shown.filter((f) => f.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
        if (people.length === 0) return null;
        return (
          <section key={kind} className="author-results" aria-labelledby={`following-${kind}`}>
            <h2 id={`following-${kind}`}>{title}</h2>
            <ul className="author-list" role="list">
              {people.map((p) => {
                const titles = catalogBy(kind, p.name, profile.ageRating).length;
                return (
                  <li key={p.name}>
                    <span className="person-mark small" aria-hidden="true">
                      {personInitials(p.name)}
                    </span>
                    <div className="author-text">
                      <Link to={personPath(kind, p.name)}>{p.name}</Link>
                      <span>{titles === 0 ? "No titles on LiteraryWorm yet" : `${titles} ${titles === 1 ? "title" : "titles"} on LiteraryWorm`}</span>
                    </div>
                    <FollowButton kind={kind} name={p.name} small />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
