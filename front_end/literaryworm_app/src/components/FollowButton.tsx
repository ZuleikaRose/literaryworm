import { useId, useState } from "react";
import { AccountError } from "../lib/accountApi";
import type { PersonKind } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import { Icon } from "./Icon";

/** Follow or unfollow an author or narrator for the active profile (saved first for members). */
export function FollowButton({ kind, name, small = false }: { kind: PersonKind; name: string; small?: boolean }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Said only after a change, so screen readers aren't told on arrival.
  const [announcement, setAnnouncement] = useState("");
  const errorId = useId();
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
        className={`${following ? "secondary-button" : "primary-button"}${small ? " small-button" : ""}`}
        aria-pressed={following}
        aria-describedby={error ? errorId : undefined}
        disabled={busy}
        onClick={toggle}
      >
        <Icon name={following ? "check" : "plus"} size={16} /> {following ? "Following" : "Follow"}
        {small && <span className="visually-hidden"> {name}</span>}
      </button>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}
