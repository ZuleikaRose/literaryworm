import { type FormEvent, useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { getBook } from "../data/books";
import { CLUB_POST_MAX, clubChapterToday, clubDate, type ClubDetail, type ClubPost, daysLeft } from "../lib/clubs";
import { chapterLabel, today } from "../lib/reading";
import { useClubs } from "../lib/useClubs";
import { useTitle } from "../lib/useTitle";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useStore } from "../store/context";
import type { Book } from "../types";

type Load = { status: "loading" } | { status: "ready"; detail: ClubDetail; me: string } | { status: "missing" } | { status: "error"; message: string };

const postTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** /clubs/:id: one book club, its pace, members and discussion (spoilers past your place stay hidden). */
export default function ClubPage() {
  const { id = "" } = useParams();
  const clubs = useClubs();
  const profile = useActiveProfile();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useTitle(load.status === "ready" ? load.detail.club.name : "Book club");

  useEffect(() => {
    let live = true;
    Promise.all([clubs.load(id), clubs.myId()]).then(
      ([detail, me]) => live && setLoad(detail ? { status: "ready", detail, me } : { status: "missing" }),
      (err: Error) => live && setLoad({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [clubs, id, attempt]);

  if (profile?.ageRating === "kids" || load.status === "missing") {
    return (
      <main className="page empty-state">
        <span className="empty-icon">
          <Icon name="users" size={28} />
        </span>
        <h1>{profile?.ageRating === "kids" ? "Book clubs are for grown-ups and teens" : "We couldn't find that club"}</h1>
        <p>{profile?.ageRating === "kids" ? "Clubs aren't on Kids profiles." : "It may have been deleted, or you're not in it. Ask its owner for the code."}</p>
        <Link className="primary-button" to="/library?view=clubs">
          Your clubs
        </Link>
      </main>
    );
  }
  if (load.status !== "ready") {
    return (
      <main className="page page-content">
        {load.status === "loading" ? (
          <p role="status">Loading the club…</p>
        ) : (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {load.message}{" "}
            <button type="button" className="text-button" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </p>
        )}
      </main>
    );
  }
  const book = getBook(load.detail.club.bookId);
  if (!book) return null;
  return <ClubView key={load.detail.club.id} detail={load.detail} me={load.me} book={book} />;
}

function ClubView({ detail, me, book }: { detail: ClubDetail; me: string; book: Book }) {
  const clubs = useClubs();
  const navigate = useNavigate();
  const { state } = useStore();
  const { club, members } = detail;
  const [posts, setPosts] = useState(detail.posts);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const isOwner = club.ownerId === me;
  const now = today();
  const target = clubChapterToday(club, book, now);
  const left = daysLeft(club, now);
  const progress = activeReading(state).progress[book.id];
  const mine = progress ? (progress.finished ? book.chapters.length - 1 : progress.chapterIndex) : -1;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(club.inviteCode);
      setCopied("Code copied.");
    } catch {
      setCopied("Couldn't copy: select the code and copy it instead.");
    }
  };

  const leaveOrDelete = async () => {
    setError(null);
    try {
      if (isOwner) await clubs.remove(club.id);
      else await clubs.leave(club.id);
      navigate("/library?view=clubs");
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  };

  const removePost = async (post: ClubPost) => {
    setError(null);
    try {
      await clubs.deletePost(club.id, post.id);
      setPosts((list) => list.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't delete the post. Try again.");
    }
  };

  return (
    <div className="club-page page-content">
      <header className="club-header">
        <Cover book={book} size="md" />
        <div>
          <p className="eyebrow">Book club</p>
          <h1>{club.name}</h1>
          <p>
            Reading <Link to={`/books/${book.id}`}>{book.title}</Link> by {book.author}
          </p>
          <p className="club-pace">
            <Icon name="clock" size={16} />{" "}
            {left > 0
              ? `Finishing ${clubDate(club.finishesOn)} (${left} ${left === 1 ? "day" : "days"} left). Today the club is at ${chapterLabel(book, target)}.`
              : `The club's finish date, ${clubDate(club.finishesOn)}, has passed.`}
          </p>
          <p className="goal-hint">{mine >= 0 ? `You're at ${chapterLabel(book, mine)}.` : "You haven't started this book yet."}</p>
          <div className="goal-actions">
            <Link className="primary-button small-button" to={`/read/${book.id}`}>
              <Icon name="bookOpen" size={15} /> Read
            </Link>
            <Link className="ghost-button small-button" to={`/listen/${book.id}`}>
              <Icon name="headphones" size={15} /> Listen
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}

      <div className="club-grid">
        <section className="club-discussion" aria-labelledby="discussion-title">
          <h2 id="discussion-title">Discussion</h2>
          <PostForm
            book={book}
            initialChapter={Math.max(0, mine)}
            onPost={async (chapter, body) => {
              const post = await clubs.addPost(club.id, chapter, body);
              setPosts((list) => [...list, post]);
            }}
          />
          {posts.length === 0 ? (
            <p className="goal-hint">No posts yet. Start the conversation.</p>
          ) : (
            <ol className="club-posts" reversed>
              {[...posts].reverse().map((post) => {
                // Chapter 1 is open to everyone, so a newcomer can see what the club is talking about.
                const spoiler = post.chapterIndex > Math.max(0, mine) && post.userId !== me && !shown.has(post.id);
                return (
                  <li key={post.id} className="club-post">
                    <p className="club-post-meta">
                      <strong>{post.userId === me ? "You" : post.author}</strong> on {chapterLabel(book, post.chapterIndex)} ·{" "}
                      <time dateTime={new Date(post.createdAt).toISOString()}>{postTime.format(post.createdAt)}</time>
                    </p>
                    {spoiler ? (
                      <p className="club-spoiler">
                        Hidden: this is about a chapter you haven't reached.{" "}
                        <button type="button" className="text-button" onClick={() => setShown((s) => new Set(s).add(post.id))}>
                          Show it anyway
                        </button>
                      </p>
                    ) : (
                      post.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)
                    )}
                    {(post.userId === me || isOwner) && (
                      <button type="button" className="text-button" onClick={() => removePost(post)}>
                        Delete<span className="visually-hidden"> this post</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="club-side">
          <section className="goal-card" aria-labelledby="invite-title">
            <h2 id="invite-title">Invite</h2>
            <p className="goal-hint">Share this code. Members join from My Library → Clubs.</p>
            <p className="club-code">
              <code>{club.inviteCode}</code>
              <button type="button" className="ghost-button small-button" onClick={copyCode}>
                Copy
              </button>
            </p>
            <p className="goal-hint" role="status">
              {copied}
            </p>
          </section>
          <section className="goal-card" aria-labelledby="members-title">
            <h2 id="members-title">
              {members.length} {members.length === 1 ? "member" : "members"}
            </h2>
            <ul className="club-members" role="list">
              {members.map((m) => (
                <li key={m.userId}>
                  {m.userId === me ? "You" : m.name}
                  {m.userId === club.ownerId && <span className="shared-tag">Started it</span>}
                </li>
              ))}
            </ul>
          </section>
          <button type="button" className="ghost-button small-button" onClick={() => setConfirming(true)}>
            <Icon name={isOwner ? "trash" : "logOut"} size={15} /> {isOwner ? "Delete club" : "Leave club"}
          </button>
        </aside>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={isOwner ? "Delete this club?" : "Leave this club?"}
        description={
          <p>
            {isOwner
              ? "Every member loses the club and its discussion. This can't be undone."
              : "Your posts in it are deleted. You can join again with the code."}
          </p>
        }
      >
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={leaveOrDelete}>
            {isOwner ? "Delete club" : "Leave club"}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            Stay
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function PostForm({ book, initialChapter, onPost }: { book: Book; initialChapter: number; onPost: (chapter: number, body: string) => Promise<void> }) {
  const [chapter, setChapter] = useState(initialChapter);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyId = useId();
  const errorId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return setError("Write something first.");
    if (trimmed.length > CLUB_POST_MAX) return setError(`Posts are up to ${CLUB_POST_MAX} characters.`);
    setBusy(true);
    setError(null);
    try {
      await onPost(chapter, trimmed);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't post that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="club-post-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${bodyId}-chapter`}>
          About
        </label>
        <select id={`${bodyId}-chapter`} className="field-input" value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
          {book.chapters.map((_, i) => (
            <option key={i} value={i}>
              {chapterLabel(book, i)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={bodyId}>
          Your post
        </label>
        <textarea
          id={bodyId}
          className="field-input log-textarea"
          rows={3}
          maxLength={CLUB_POST_MAX}
          value={body}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && (
          <p className="field-error" id={errorId}>
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
      </div>
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
