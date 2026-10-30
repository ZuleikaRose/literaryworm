import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { BookFeed } from "../components/BookFeed";
import { FollowButton } from "../components/FollowButton";
import { Shelf } from "../components/Shelf";
import { usesBackend } from "../lib/backend";
import { fromLocal } from "../lib/booksApi";
import { fetchFollowerCount } from "../lib/followersApi";
import { catalogBy, followerCountNow, followerLabel, type PersonKind, personInitials, personName } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";
import NotFound from "./NotFound";

/** An author's or narrator's page (/authors/:name, /narrators/:name): their titles and a Follow button. */
export default function Person({ kind }: { kind: PersonKind }) {
  const name = personName(useParams().name);
  if (!name) return <NotFound />;
  return <PersonPage key={`${kind}:${name}`} kind={kind} name={name} />;
}

function PersonPage({ kind, name }: { kind: PersonKind; name: string }) {
  const profile = useActiveProfile();
  const signedIn = Boolean(useStore().state.account);
  const ageRating = profile?.ageRating ?? "all";
  const role = kind === "author" ? "Author" : "Narrator";
  useTitle(`${name} (${role.toLowerCase()})`);
  const catalog = catalogBy(kind, name, ageRating);
  // Google Books lists authors, not narrators; Kids profiles see only the catalog.
  const showGoogle = kind === "author" && usesBackend && ageRating !== "kids";
  const initials = personInitials(name);
  const following = useFollows().isFollowing(kind, name);
  // Read once per page; following or unfollowing here moves it by one. Whether the profile
  // followed is taken when the count arrives, since its follows may load after the page opens.
  const followingRef = useRef(following);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  const [followers, setFollowers] = useState<{ count: number; followedAtLoad: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    void fetchFollowerCount(kind, name).then((count) => {
      if (live && count !== null) setFollowers({ count, followedAtLoad: followingRef.current });
    });
    return () => {
      live = false;
    };
  }, [kind, name]);
  const followersText = followers ? followerLabel(followerCountNow(followers.count, followers.followedAtLoad, following)) : null;

  return (
    <div className="page-content person-page">
      <BackLink />
      <header className="person-hero">
        <span className="person-mark" aria-hidden="true">
          {initials}
        </span>
        <div className="person-heading">
          <p className="eyebrow">{role}</p>
          <h1>{name}</h1>
          <p className="person-count">
            {catalog.length === 0
              ? "No titles on LiteraryWorm yet"
              : `${catalog.length} ${catalog.length === 1 ? "title" : "titles"} on LiteraryWorm`}
            {kind === "narrator" && catalog.length > 0 && ", read by them"}
          </p>
          {followersText && <p className="person-count">{followersText}</p>}
        </div>
        {profile ? (
          <FollowButton kind={kind} name={name} />
        ) : (
          // Following belongs to a profile: signed in, they choose one first.
          <Link className="secondary-button" to={signedIn ? "/profiles" : "/signin"}>
            {signedIn ? "Choose a profile to follow" : "Log in to follow"}
          </Link>
        )}
      </header>

      {catalog.length > 0 && (
        <Shelf
          id="person-catalog"
          eyebrow="Read or listen now"
          title={kind === "author" ? `By ${name} on LiteraryWorm` : `Narrated by ${name}`}
          items={catalog.map(fromLocal)}
        />
      )}
      {showGoogle && (
        <BookFeed
          id="person-google"
          eyebrow="From Google Books"
          title={`More by ${name}`}
          query={{ mode: "author", name }}
          ageRating={ageRating}
          emptyHint="Google Books has nothing else under this name."
          endText="That's everything Google Books lists under this name."
        />
      )}
      {catalog.length === 0 && !showGoogle && (
        <p className="person-empty">
          {kind === "narrator"
            ? "Nothing narrated by them is on LiteraryWorm for this profile yet."
            : "Nothing by them is on LiteraryWorm for this profile yet."}{" "}
          Follow them to see their new titles first on Home.
        </p>
      )}
    </div>
  );
}
