import { type FormEvent, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { books, getBook, isAllowed } from "../data/books";
import { type ClubPoll, leader, POLL_DEFAULT_QUESTION, POLL_OPTIONS_MAX, POLL_QUESTION_MAX, pollError, tally } from "../lib/clubPolls";
import { keywordText, wordsMatch } from "../lib/search";
import { useClubPolls } from "../lib/useClubPolls";
import type { AgeRating } from "../types";
import { Icon } from "./Icon";

const titleOf = (id: string) => getBook(id)?.title ?? "A LiteraryWorm title";
const votesText = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`;

/**
 * Polls on a club's page (lib/clubPolls.ts, lib/useClubPolls.ts): the owner offers 2 to 5
 * LiteraryWorm titles and asks what to read next; members vote and see everyone's votes; the
 * owner closes the poll and can start a club with the winner. The newest open poll and the
 * newest closed one are shown.
 */
export function ClubPolls({
  clubId,
  isOwner,
  me,
  members,
  ageRating,
}: {
  clubId: string;
  isOwner: boolean;
  me: string;
  members: { userId: string; name: string }[];
  ageRating: AgeRating;
}) {
  const { polls, error: loadError, vote, start, close, remove } = useClubPolls(clubId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const titleId = useId();
  const open = polls?.find((p) => p.closedAt === null);
  const closed = polls?.find((p) => p.closedAt !== null);
  const nameOf = (userId: string) => (userId === me ? "You" : (members.find((m) => m.userId === userId)?.name ?? "A member"));

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="goal-card club-polls" aria-labelledby={titleId}>
      <h2 id={titleId}>What to read next</h2>
      {loadError && <p className="goal-hint">{loadError}</p>}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {open && <OpenPoll poll={open} me={me} isOwner={isOwner} busy={busy} nameOf={nameOf} act={act} vote={vote} close={close} remove={remove} />}
      {closed && (!open || isOwner) && (
        <div className="club-poll-result">
          <p>
            <strong>{titleOf(closed.winner ?? "")}</strong> won <q>{closed.question}</q> with {votesText(tally(closed)[closed.options.indexOf(closed.winner ?? "")] ?? 0)}.
          </p>
          <div className="goal-actions">
            <Link className="ghost-button small-button" to={`/books/${closed.winner}`}>
              About the book
            </Link>
            {isOwner && (
              <>
                <Link className="primary-button small-button" to={`/library?view=clubs&start=${closed.winner}`}>
                  Start a club with it
                </Link>
                <button type="button" className="text-button" disabled={busy} onClick={() => act(() => remove(closed))}>
                  Delete<span className="visually-hidden"> the closed poll</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {!open && polls && !asking && (
        <>
          {!closed && <p className="goal-hint">{isOwner ? "Ask the club what to read next: offer two to five books and everyone votes." : "No polls yet. The club's owner can ask what to read next."}</p>}
          {isOwner && (
            <button type="button" className="secondary-button small-button" onClick={() => setAsking(true)}>
              <Icon name="plus" size={15} /> Start a poll
            </button>
          )}
        </>
      )}
      {asking && isOwner && !open && (
        <PollForm
          ageRating={ageRating}
          busy={busy}
          onCancel={() => setAsking(false)}
          onStart={(question, options) =>
            act(async () => {
              await start(question, options);
              setAsking(false);
            })
          }
        />
      )}
    </section>
  );
}

function OpenPoll({
  poll,
  me,
  isOwner,
  busy,
  nameOf,
  act,
  vote,
  close,
  remove,
}: {
  poll: ClubPoll;
  me: string;
  isOwner: boolean;
  busy: boolean;
  nameOf: (userId: string) => string;
  act: (work: () => Promise<void>) => Promise<void>;
  vote: (poll: ClubPoll, choice: number | null, me: string) => Promise<void>;
  close: (poll: ClubPoll, winnerIfDemo: string) => Promise<void>;
  remove: (poll: ClubPoll) => Promise<void>;
}) {
  const counts = tally(poll);
  const mine = poll.votes[me];
  return (
    <div className="club-poll">
      <h3>{poll.question}</h3>
      <ul className="club-poll-options" role="list">
        {poll.options.map((id, i) => {
          const voters = Object.entries(poll.votes)
            .filter(([, c]) => c === i)
            .map(([u]) => nameOf(u));
          const book = getBook(id);
          return (
            <li key={id} className={mine === i ? "is-mine" : undefined}>
              <div>
                <Link to={`/books/${id}`}>{book?.title ?? id}</Link>
                {book && <small> by {book.author}</small>}
                <p className="goal-hint">
                  {votesText(counts[i])}
                  {voters.length > 0 && `: ${voters.join(", ")}`}
                </p>
              </div>
              <button
                type="button"
                className={mine === i ? "primary-button small-button" : "ghost-button small-button"}
                aria-pressed={mine === i}
                disabled={busy}
                onClick={() => act(() => vote(poll, mine === i ? null : i, me))}
              >
                {mine === i ? "Your vote" : "Vote"}
                <span className="visually-hidden"> for {book?.title ?? id}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="goal-hint">{mine === undefined ? "Choose a book to vote. You can change your vote until the poll closes." : "Select Your vote again to take it back."}</p>
      {isOwner && (
        <div className="goal-actions">
          <button type="button" className="secondary-button small-button" disabled={busy} onClick={() => act(() => close(poll, leader(poll)))}>
            Close the poll
          </button>
          <button type="button" className="text-button" disabled={busy} onClick={() => act(() => remove(poll))}>
            Delete<span className="visually-hidden"> the poll</span>
          </button>
        </div>
      )}
    </div>
  );
}

function PollForm({
  ageRating,
  busy,
  onCancel,
  onStart,
}: {
  ageRating: AgeRating;
  busy: boolean;
  onCancel: () => void;
  onStart: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState(POLL_DEFAULT_QUESTION);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const catalog = useMemo(() => books.filter((b) => isAllowed(b.ageRating, ageRating)), [ageRating]);
  const found = useMemo(
    () => (query.trim() ? catalog.filter((b) => !options.includes(b.id) && wordsMatch(keywordText(b), query)).slice(0, 6) : []),
    [catalog, query, options],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = pollError(question, options);
    setError(problem);
    if (!problem) onStart(question, options);
  };

  return (
    <form className="club-poll-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-q`}>
          Question
        </label>
        <input id={`${id}-q`} className="field-input" maxLength={POLL_QUESTION_MAX} value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-find`}>
          Find a book to offer
        </label>
        <input
          id={`${id}-find`}
          className="field-input"
          type="search"
          value={query}
          disabled={options.length >= POLL_OPTIONS_MAX}
          aria-describedby={`${id}-count`}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="goal-hint" id={`${id}-count`}>
          {options.length} of {POLL_OPTIONS_MAX} books chosen. Search by title, author or keywords.
        </p>
      </div>
      {found.length > 0 && (
        <ul className="club-poll-found" role="list" aria-label="Books found">
          {found.map((b) => (
            <li key={b.id}>
              <span>
                {b.title} <small>by {b.author}</small>
              </span>
              <button
                type="button"
                className="ghost-button small-button"
                onClick={() => {
                  setOptions((list) => [...list, b.id]);
                  setQuery("");
                }}
              >
                Add<span className="visually-hidden"> {b.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 && (
        <ol className="club-poll-chosen" aria-label="Books in the poll">
          {options.map((o) => (
            <li key={o}>
              <span>{titleOf(o)}</span>
              <button type="button" className="text-button" onClick={() => setOptions((list) => list.filter((x) => x !== o))}>
                Remove<span className="visually-hidden"> {titleOf(o)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p className="field-error" role="alert" id={`${id}-error`}>
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy} aria-describedby={error ? `${id}-error` : undefined}>
          Start the poll
        </button>
        <button type="button" className="ghost-button small-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
