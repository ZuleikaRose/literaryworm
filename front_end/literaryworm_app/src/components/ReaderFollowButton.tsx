import { useState } from "react";
import { useReaderFollows } from "../lib/useReaderFollows";
import { Icon } from "./Icon";

/** Follow / Following for a reader's page (members' grown-up and teen profiles). */
export function ReaderFollowButton({ readerId, name }: { readerId: string; name: string }) {
  const readers = useReaderFollows();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!readers.available || readers.isSelf(readerId)) return null;
  const following = readers.isFollowing(readerId);

  return (
    <div className="reader-follow">
      <button
        type="button"
        className={following ? "secondary-button" : "primary-button"}
        aria-pressed={following}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await readers.toggle(readerId, name);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name={following ? "check" : "plus"} size={16} /> {following ? "Following" : "Follow"}
        <span className="visually-hidden"> {name}</span>
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </div>
  );
}
