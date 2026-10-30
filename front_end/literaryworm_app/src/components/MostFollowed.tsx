import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMostFollowed } from "../lib/followersApi";
import { followerCountNow, followersShort, personInitials, personPath } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import { FollowButton } from "./FollowButton";

/** Fewer than this and the row isn't worth showing. */
const MIN_AUTHORS = 3;

/**
 * Home's *Most-followed authors*: the authors most reader profiles follow (most_followed(), names
 * and counts, never who), each with their page and Follow. Left out until there are a few, or
 * when the counts can't be read. Not shown to Kids profiles (Browse leaves it out).
 */
export function MostFollowed() {
  const id = useId();
  const follows = useFollows();
  // Whether the profile followed each author when the counts came, so Follow moves the number.
  const followsRef = useRef(follows);
  useEffect(() => {
    followsRef.current = follows;
  }, [follows]);
  const [authors, setAuthors] = useState<{ name: string; count: number; followedAtLoad: boolean }[] | null>(null);

  useEffect(() => {
    let live = true;
    void fetchMostFollowed("author").then((found) => {
      if (!live || !found) return;
      setAuthors(found.map((a) => ({ name: a.name, count: a.followers, followedAtLoad: followsRef.current.isFollowing("author", a.name) })));
    });
    return () => {
      live = false;
    };
  }, []);

  if (!authors || authors.length < MIN_AUTHORS) return null;

  return (
    <section className="author-results most-followed" aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">What readers here follow</p>
          <h2 id={`${id}-title`}>Most-followed authors</h2>
        </div>
      </div>
      <ul className="author-list" role="list">
        {authors.map((a) => (
          <li key={a.name}>
            <span className="person-mark small" aria-hidden="true">
              {personInitials(a.name)}
            </span>
            <div className="author-text">
              <Link to={personPath("author", a.name)}>{a.name}</Link>
              <span>{followersShort(followerCountNow(a.count, a.followedAtLoad, follows.isFollowing("author", a.name)))}</span>
            </div>
            <FollowButton kind="author" name={a.name} small />
          </li>
        ))}
      </ul>
    </section>
  );
}
