import { useId, useState } from "react";
import { type ClubMember } from "../lib/clubs";
import { placeLabel } from "../lib/clubPlaces";
import { useClubPlaces } from "../lib/useClubPlaces";
import { Icon } from "./Icon";

/**
 * Where everyone is, on a club's page: the members who show their place, furthest first, and this
 * account's own choice to show it. Chapter numbers only; posts past the reader's chapter stay hidden.
 */
export function ClubPlaces({ clubId, members, me }: { clubId: string; members: ClubMember[]; me: string | null }) {
  const { places, sharing, error, setShare } = useClubPlaces(clubId, members, me);
  const [busy, setBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const hintId = useId();
  const others = (places ?? []).filter((p) => p.userId !== me);

  return (
    <section className="goal-card club-places" aria-labelledby="places-title">
      <h2 id="places-title">Where everyone is</h2>
      {places === null && !error ? (
        <p className="muted">Loading…</p>
      ) : others.length === 0 ? (
        <p className="muted">No one else is showing their place yet.</p>
      ) : (
        <ul className="club-places-list">
          {others.map((p) => (
            <li key={p.userId}>
              <span className="club-place-name">{p.name}</span>
              <span className="club-place-where">{placeLabel(p)}</span>
              <span className="club-place-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((p.finished ? 1 : p.fraction) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {sharing !== null && (
        <label className="switch-row">
          <span>
            <strong>Show my place to this club</strong>
            <small id={hintId}>Members see your chapter and how far through you are. Nothing else about your reading.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            aria-describedby={hintId}
            checked={sharing}
            disabled={busy}
            onChange={async (e) => {
              const on = e.target.checked;
              setBusy(true);
              setChangeError(null);
              try {
                await setShare(on);
              } catch (err) {
                setChangeError(err instanceof Error ? err.message : "We couldn't change that. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {changeError && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {changeError}
        </p>
      )}
    </section>
  );
}
