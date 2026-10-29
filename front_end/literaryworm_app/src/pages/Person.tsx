import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { BookFeed } from "../components/BookFeed";
import { Icon } from "../components/Icon";
import { Shelf } from "../components/Shelf";
import { AccountError } from "../lib/accountApi";
import { usesBackend } from "../lib/backend";
import { fromLocal } from "../lib/booksApi";
import { catalogBy, type PersonKind, personName } from "../lib/people";
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
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

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

function FollowButton({ kind, name }: { kind: PersonKind; name: string }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Said only after a change, so screen readers aren't told on arrival.
  const [announcement, setAnnouncement] = useState("");
  const following = follows.isFollowing(kind, name);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await follows.toggle(kind, name);
      setAnnouncement(following ? `You no longer follow ${name}.` : `You follow ${name}.`);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="person-follow">
      <button
        type="button"
        className={following ? "secondary-button" : "primary-button"}
        aria-pressed={following}
        aria-describedby={error ? "follow-error" : undefined}
        disabled={busy}
        onClick={toggle}
      >
        <Icon name={following ? "check" : "plus"} size={16} /> {following ? "Following" : "Follow"}
      </button>
      {error && (
        <p className="field-error" id="follow-error" role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}
