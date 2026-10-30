import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  type Challenge,
  CHALLENGE_KINDS,
  CHALLENGE_TARGET_MAX,
  CHALLENGE_TITLE_MAX,
  challengeError,
  type ChallengeKind,
  challengeStatus,
  daysLeft,
  dayLabel,
  defaultTitle,
  presetRange,
  RANGE_PRESETS,
  type RangePreset,
  rangeLabel,
  standings,
  unit,
} from "../lib/challenges";
import { today } from "../lib/reading";
import { useChallenges } from "../lib/useChallenges";
import { useStore } from "../store/context";
import type { Profile } from "../types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Try again.");

/**
 * My Library → Goals → Household challenges: goals the household's profiles take on together.
 * Everyone on the account sees every challenge and each other's progress (from their reading
 * days); the active profile joins, leaves, starts one, or deletes one it started.
 */
export function ChallengesView({ profile }: { profile: Profile }) {
  const challenges = useChallenges();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refresh = useCallback(
    () =>
      challenges.list().then(
        (found) => {
          setList(found);
          setLoadError(null);
        },
        (err) => setLoadError(message(err)),
      ),
    [challenges],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const now = today();
  const active = (list ?? []).filter((c) => challengeStatus(c, now) !== "ended");
  const ended = (list ?? []).filter((c) => challengeStatus(c, now) === "ended");

  return (
    <section className="challenges" aria-labelledby="challenges-title">
      <div className="challenges-heading">
        <div>
          <h2 id="challenges-title" tabIndex={-1} ref={headingRef}>
            Household challenges
          </h2>
          <p className="goal-hint">Goals to take on together. Everyone in the household can join and see how the others are doing.</p>
        </div>
        {!starting && (
          <button type="button" className="primary-button small-button" onClick={() => setStarting(true)}>
            <Icon name="plus" size={15} /> Start a challenge
          </button>
        )}
      </div>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      {starting && (
        <StartChallenge
          profile={profile}
          onCancel={() => setStarting(false)}
          onStarted={async (title) => {
            setStarting(false);
            setAnnouncement(`Started ${title}.`);
            await refresh();
            headingRef.current?.focus();
          }}
        />
      )}

      {loadError ? (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{loadError}</p>
            <button type="button" className="secondary-button small-button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        </div>
      ) : list === null ? (
        <p className="goal-hint">Loading challenges…</p>
      ) : list.length === 0 ? (
        !starting && <p className="challenges-empty">No challenges yet. Start one, and the rest of the household can join in.</p>
      ) : (
        <>
          <ul className="challenge-list" role="list">
            {active.map((c) => (
              <ChallengeCard key={c.id} challenge={c} profile={profile} now={now} onChanged={refresh} onAnnounce={setAnnouncement} afterDelete={() => headingRef.current?.focus()} />
            ))}
          </ul>
          {ended.length > 0 && (
            <details className="challenges-ended">
              <summary>
                Finished challenges ({ended.length})
              </summary>
              <ul className="challenge-list" role="list">
                {ended.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} profile={profile} now={now} onChanged={refresh} onAnnounce={setAnnouncement} afterDelete={() => headingRef.current?.focus()} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function ChallengeCard({
  challenge: c,
  profile,
  now,
  onChanged,
  onAnnounce,
  afterDelete,
}: {
  challenge: Challenge;
  profile: Profile;
  now: string;
  onChanged: () => Promise<void>;
  onAnnounce: (text: string) => void;
  afterDelete: () => void;
}) {
  const { state } = useStore();
  const challenges = useChallenges();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = challengeStatus(c, now);
  const joined = c.participants.includes(profile.id);
  const daysByProfile = Object.fromEntries(state.profiles.map((p) => [p.id, state.profileData[p.id]?.readingDays]));
  const rows = standings(c, daysByProfile);
  const nameOf = (id: string) => state.profiles.find((p) => p.id === id);
  const left = daysLeft(c, now);
  const when =
    status === "upcoming"
      ? `Starts ${dayLabel(c.startsOn)}`
      : status === "ended"
        ? "Finished"
        : `${left} ${left === 1 ? "day" : "days"} left`;

  const run = async (action: () => Promise<void>, done: string, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onAnnounce(done);
      await onChanged();
      after?.();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="challenge-card">
      <div className="challenge-top">
        <div>
          <h3>{c.title}</h3>
          <p className="goal-hint">
            {CHALLENGE_KINDS.find((k) => k.value === c.kind)?.label} · {rangeLabel(c.startsOn, c.endsOn)} · <strong>{when}</strong>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="goal-hint">Nobody has joined yet.</p>
      ) : (
        <ol className="challenge-standings" aria-label={`Progress in ${c.title}`}>
          {rows.map((r) => {
            const who = nameOf(r.profileId);
            if (!who) return null;
            return (
              <li key={r.profileId}>
                <Avatar name={who.name} avatar={who.avatar} size={32} />
                <span className="challenge-name">
                  {who.name}
                  {who.id === profile.id && <span className="visually-hidden"> (you)</span>}
                </span>
                <progress className="goal-bar" max={c.target} value={Math.min(r.value, c.target)} aria-label={`${who.name}: ${r.value} of ${c.target} ${unit(c.kind, c.target)}`} />
                <span className="challenge-count">
                  {r.done ? (
                    <>
                      <Icon name="check" size={15} /> Done
                    </>
                  ) : (
                    `${r.value} / ${c.target}`
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}

      <div className="goal-actions">
        {status !== "ended" &&
          (joined ? (
            <button type="button" className="ghost-button small-button" disabled={busy} onClick={() => run(() => challenges.leave(c.id, profile.id), `${profile.name} left ${c.title}.`)}>
              Leave<span className="visually-hidden"> {c.title}</span>
            </button>
          ) : (
            <button type="button" className="secondary-button small-button" disabled={busy} onClick={() => run(() => challenges.join(c.id, profile.id), `${profile.name} joined ${c.title}.`)}>
              Join<span className="visually-hidden"> {c.title}</span>
            </button>
          ))}
        {c.createdBy === profile.id && (
          <button
            type="button"
            className="ghost-button small-button danger-text"
            disabled={busy}
            onClick={() => run(() => challenges.remove(c.id), `Deleted ${c.title}.`, afterDelete)}
          >
            <Icon name="trash" size={15} /> Delete<span className="visually-hidden"> {c.title}</span>
          </button>
        )}
      </div>
    </li>
  );
}

function StartChallenge({ profile, onCancel, onStarted }: { profile: Profile; onCancel: () => void; onStarted: (title: string) => Promise<void> }) {
  const challenges = useChallenges();
  const now = today();
  const [kind, setKind] = useState<ChallengeKind>("books");
  const [target, setTarget] = useState("5");
  const [preset, setPreset] = useState<RangePreset>("this-month");
  const range = presetRange(preset, now);
  const suggested = defaultTitle(kind, Number(target) || 1, range.startsOn, range.endsOn);
  // The suggested name follows the choices until the person types their own.
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { title: title ?? suggested, kind, target: Number(target), ...range };
    const problem = challengeError(input, now);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const made = await challenges.create(profile.id, input);
      await onStarted(made.title);
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <form className="goal-card challenge-form" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Start a challenge</h3>
      <div className="challenge-form-row">
        <div className="field">
          <label className="field-label" htmlFor={`${id}-kind`}>
            Count
          </label>
          <select ref={firstRef} id={`${id}-kind`} className="field-input" value={kind} onChange={(e) => setKind(e.target.value as ChallengeKind)}>
            {CHALLENGE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-target`}>
            Target
          </label>
          <input
            id={`${id}-target`}
            className="field-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={CHALLENGE_TARGET_MAX}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
      </div>
      <fieldset className="segmented">
        <legend className="field-label">When</legend>
        <div>
          {RANGE_PRESETS.map((p) => (
            <label key={p.value}>
              <input type="radio" name={`${id}-when`} value={p.value} checked={preset === p.value} onChange={() => setPreset(p.value)} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="goal-hint">{rangeLabel(range.startsOn, range.endsOn)}</p>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          className="field-input"
          maxLength={CHALLENGE_TITLE_MAX}
          value={title ?? suggested}
          onChange={(e) => setTitle(e.target.value)}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <p className="goal-hint">{profile.name} joins straight away; the rest of the household can join from here.</p>
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Starting…" : "Start the challenge"}
        </button>
        <button type="button" className="ghost-button small-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
