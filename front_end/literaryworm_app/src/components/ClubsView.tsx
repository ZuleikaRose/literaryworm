import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { books, getBook, isAllowed } from "../data/books";
import { onClubPost } from "../lib/clubEvents";
import { type Club, CLUB_DAYS_MAX, CLUB_NAME_MAX, clubChapterToday, clubDate, type ClubMembership, isInviteCode, newInviteCode, spoilerFreeUpTo, unreadUpTo } from "../lib/clubs";
import { today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { activeReading } from "../store/reducer";
import { useStore } from "../store/context";
import type { Profile } from "../types";
import { Cover } from "./Cover";
import { Field } from "./Field";
import { Icon } from "./Icon";

const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Load = { status: "loading" } | { status: "ready"; clubs: Club[] } | { status: "error"; message: string };

/** My Library → Clubs: the clubs this account is in, starting one, and joining one with a code. */
export function ClubsView({ profile }: { profile: Profile }) {
  const clubs = useClubs();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [memberships, setMemberships] = useState<Record<string, ClubMembership>>({});
  const progress = activeReading(useStore().state).progress;

  // New posts per club: loaded with the list, and again when one arrives while this is open.
  useEffect(() => {
    let live = true;
    const loadCounts = () =>
      clubs.memberships().then(
        (m) => live && setMemberships(m),
        (err: Error) => console.error("clubs: couldn't count new posts:", err.message),
      );
    void loadCounts();
    const stop = onClubPost(() => void loadCounts());
    return () => {
      live = false;
      stop();
    };
  }, [clubs, attempt]);

  useEffect(() => {
    let live = true;
    clubs.list().then(
      (list) => live && setLoad({ status: "ready", clubs: list }),
      (err: Error) => live && setLoad({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [clubs, attempt]);

  if (profile.ageRating === "kids") {
    return (
      <div className="library-empty">
        <Icon name="users" size={28} />
        <h3>Book clubs are for grown-ups and teens</h3>
        <p>Clubs let people talk about a book together, so they aren't on Kids profiles.</p>
      </div>
    );
  }

  const now = today();
  return (
    <div className="clubs">
      {load.status === "loading" && (
        <p className="goal-hint" role="status">
          Loading your clubs…
        </p>
      )}
      {load.status === "error" && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {load.message}{" "}
          <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
      {load.status === "ready" &&
        (load.clubs.length === 0 ? (
          <div className="library-empty">
            <Icon name="users" size={28} />
            <h3>No book clubs yet</h3>
            <p>Start one around a LiteraryWorm title and share its code, or join a club with a code someone sent you.</p>
          </div>
        ) : (
          <ul className="club-list" role="list">
            {load.clubs.map((club) => {
              const book = getBook(club.bookId);
              // Posts about chapters past the reader's place aren't counted: the count can't spoil anything.
              const fresh = book ? unreadUpTo(memberships[club.id]?.unread ?? {}, spoilerFreeUpTo(progress[book.id], book)) : 0;
              return (
                <li key={club.id} className="club-card">
                  {book && <Cover book={book} size="sm" />}
                  <div>
                    <Link to={`/clubs/${club.id}`} className="club-card-title">
                      {club.name}
                      {fresh > 0 && <span className="club-new"> {fresh} new</span>}
                    </Link>
                    <p>{book?.title ?? "A LiteraryWorm title"}</p>
                    <small>
                      {club.memberCount} {club.memberCount === 1 ? "member" : "members"} · finishing {clubDate(club.finishesOn)}
                      {book && ` · today: chapter ${clubChapterToday(club, book, now) + 1}`}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      <div className="club-forms">
        <section className="goal-card" aria-labelledby="start-club-title">
          <h2 id="start-club-title">Start a club</h2>
          {starting ? (
            <StartClubForm profile={profile} onCancel={() => setStarting(false)} />
          ) : (
            <>
              <p className="goal-hint">Pick a book and a finish date; LiteraryWorm paces the chapters and gives you a code to share.</p>
              <div className="goal-actions">
                <button type="button" className="primary-button small-button" onClick={() => setStarting(true)}>
                  <Icon name="plus" size={15} /> Start a club
                </button>
              </div>
            </>
          )}
        </section>
        <JoinClubForm />
      </div>
      {!clubs.remote && <p className="goal-hint">The demo has one sample club. Clubs you start here stay in this tab and reset when you refresh.</p>}
    </div>
  );
}

function StartClubForm({ profile, onCancel }: { profile: Profile; onCancel: () => void }) {
  const clubs = useClubs();
  const navigate = useNavigate();
  const now = today();
  const choices = books.filter((b) => isAllowed(b.ageRating, profile.ageRating));
  const [name, setName] = useState("");
  const [bookId, setBookId] = useState(choices[0]?.id ?? "");
  const [finishesOn, setFinishesOn] = useState(addDays(now, 28));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > CLUB_NAME_MAX) return setError(`Give the club a name of up to ${CLUB_NAME_MAX} characters.`);
    if (!getBook(bookId)) return setError("Choose a book.");
    if (!(finishesOn > now && finishesOn <= addDays(now, CLUB_DAYS_MAX))) return setError("Choose a finish date after today and within a year.");
    setBusy(true);
    setError(null);
    try {
      const id = await clubs.create({ name: trimmed, bookId, startsOn: now, finishesOn, inviteCode: newInviteCode() });
      navigate(`/clubs/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the club. Try again.");
      setBusy(false);
    }
  };

  return (
    <form className="goal-form club-form" onSubmit={submit} noValidate>
      <Field label="Club name" value={name} maxLength={CLUB_NAME_MAX} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <div className="field">
        <label className="field-label" htmlFor="club-book">
          Book
        </label>
        <select id="club-book" className="field-input" value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {choices.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.author})
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Finish by"
        type="date"
        min={addDays(now, 1)}
        max={addDays(now, CLUB_DAYS_MAX)}
        value={finishesOn}
        onChange={(e) => setFinishesOn(e.target.value)}
      />
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Starting…" : "Start club"}
        </button>
        <button type="button" className="ghost-button small-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function JoinClubForm() {
  const clubs = useClubs();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!isInviteCode(trimmed)) return setError("A club code is 10 letters and numbers.");
    setBusy(true);
    setError(null);
    try {
      const id = await clubs.join(trimmed);
      if (id) navigate(`/clubs/${id}`);
      else {
        setError("That code doesn't match a club. Check it with the person who sent it.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't join the club. Try again.");
      setBusy(false);
    }
  };

  return (
    <section className="goal-card" aria-labelledby="join-club-title">
      <h2 id="join-club-title">Join a club</h2>
      <form className="goal-form" onSubmit={submit} noValidate>
        <Field
          label="Club code"
          value={code}
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          error={error ?? undefined}
        />
        <div className="goal-actions">
          <button type="submit" className="primary-button small-button" disabled={busy}>
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
      </form>
    </section>
  );
}
