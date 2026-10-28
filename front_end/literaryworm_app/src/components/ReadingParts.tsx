import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useUploadedBook } from "../lib/uploads";
import { getBook, isAllowed } from "../data/books";
import { EXTRA_MINUTES } from "../lib/useDailyLimit";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";
import type { Book, Bookmark, Format } from "../types";
import { AccountPasswordField } from "./AccountPasswordField";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/** A full-screen message in place of the reader or player. */
export function ReadingMessage({ title, icon, children, action }: { title: string; icon: "lock" | "bookOpen" | "clock"; children: ReactNode; action?: ReactNode }) {
  useTitle(title);
  return (
    <main className="page empty-state reading-message">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h1>{title}</h1>
      {children}
      {action}
    </main>
  );
}

/**
 * Opens a book in the reader or the player only when it can be: a LiteraryWorm title, in that
 * format, that the profile may see. Otherwise it says why and where to go instead.
 */
export function ReadingGate({ format, children }: { format: Format; children: (book: Book) => ReactNode }) {
  const { id } = useParams();
  const uploaded = useUploadedBook(id);
  const book = getBook(id) ?? uploaded;
  const profile = useActiveProfile();
  const { account } = useStore().state;
  // When the page opened; enough to tell whether a cancelled plan's end date has passed.
  const [openedAt] = useState(() => Date.now());
  const verb = format === "ebook" ? "read" : "listen to";

  // A paused membership, or one whose cancellation date has passed, doesn't open books.
  if (account?.status === "paused") {
    return (
      <ReadingMessage
        title="Your membership is paused"
        icon="clock"
        action={
          <Link className="primary-button" to="/account#plan">
            Resume in Account
          </Link>
        }
      >
        <p>Reading and listening start again as soon as the membership is resumed. Your place in every book is saved.</p>
      </ReadingMessage>
    );
  }
  if (account?.status === "cancelled" || (account?.endsAt && Date.parse(account.endsAt) <= openedAt)) {
    return (
      <ReadingMessage
        title="Your membership has ended"
        icon="lock"
        action={
          <Link className="primary-button" to="/plans">
            Choose a plan
          </Link>
        }
      >
        <p>Choose a plan to keep reading. Your library and your place in every book are still here.</p>
      </ReadingMessage>
    );
  }

  if (!book) {
    return (
      <ReadingMessage
        title={`You can't ${verb} this book here`}
        icon="bookOpen"
        action={
          <Link className="primary-button" to={id ? `/books/${id}` : "/browse"}>
            {id ? "Back to the book" : "Go to home"}
          </Link>
        }
      >
        <p>LiteraryWorm can open only its own titles. Books from Google Books can be saved to your library and logged, but not read or played here.</p>
      </ReadingMessage>
    );
  }
  if (profile && !isAllowed(book.ageRating, profile.ageRating)) {
    return (
      <ReadingMessage title={`This book isn't on ${profile.name}'s shelf`} icon="lock" action={<Link className="primary-button" to="/browse">Go to home</Link>}>
        <p>
          {profile.ageRating === "kids"
            ? "Kids profiles show books picked for younger readers. Ask a grown-up if you'd like this one."
            : "This title is rated for adults. A grown-up can open it from their own profile."}
        </p>
      </ReadingMessage>
    );
  }
  if (!book.formats.includes(format)) {
    const other = format === "ebook" ? "audiobook" : "ebook";
    return (
      <ReadingMessage
        title={`${book.title} has no ${format}`}
        icon="bookOpen"
        action={
          <Link className="primary-button" to={`/${format === "ebook" ? "listen" : "read"}/${book.id}`}>
            {format === "ebook" ? "Listen instead" : "Read instead"}
          </Link>
        }
      >
        <p>It's available as an {other} only.</p>
      </ReadingMessage>
    );
  }
  return <>{children(book)}</>;
}

/** Shown once the profile's daily limit is used up. A grown-up can allow 30 more minutes. */
export function DailyLimitReached({ limitMinutes, onAllowMore }: { limitMinutes: number; onAllowMore: () => void }) {
  const profile = useActiveProfile();
  const checkPassword = useCheckAccountPassword();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await checkPassword(password);
    setBusy(false);
    if (result.ok) {
      onAllowMore();
      return;
    }
    setError(result.problem ?? "That's not the account password. Try again.");
    field.current?.focus();
  };

  const hours = limitMinutes >= 60 ? `${limitMinutes / 60} hour${limitMinutes === 60 ? "" : "s"}` : `${limitMinutes} minutes`;
  return (
    <ReadingMessage
      title="That's today's reading time"
      icon="clock"
      action={
        !asking && (
          <div className="reading-message-actions">
            <Link className="primary-button" to="/browse">
              Go to home
            </Link>
            <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
              Ask a grown-up for more time
            </button>
          </div>
        )
      }
    >
      <p>
        {profile?.name ?? "This profile"} can read and listen for {hours} a day. Your place is saved, so you can pick up here
        tomorrow.
      </p>
      {asking && (
        <form className="grown-up-form" noValidate onSubmit={submit}>
          <AccountPasswordField
            ref={field}
            value={password}
            onChange={(value) => {
              setPassword(value);
              setError(null);
            }}
            error={error}
          />
          <div className="reading-message-actions">
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Checking…" : `Allow ${EXTRA_MINUTES} more minutes`}
            </button>
            <button type="button" className="secondary-button" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </ReadingMessage>
  );
}

/** Asked when the progress bar reaches the end, so a stray drag doesn't finish the book. */
export function MarkFinishedDialog({ open, title, onFinish, onCancel }: { open: boolean; title: string; onFinish: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel} title="Mark as finished?" size="sm" description={<p>{title} will move to Finished in your library and leave Continue reading.</p>}>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Not yet
        </button>
        <button type="button" className="primary-button" onClick={onFinish}>
          <Icon name="check" size={18} /> Mark as finished
        </button>
      </div>
    </Dialog>
  );
}

/** The chapter list, with the current chapter marked. */
export function ChaptersDialog({
  open,
  onClose,
  book,
  current,
  detail,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  book: Book;
  current: number;
  /** Extra text per chapter (page or start time). */
  detail: (index: number) => string;
  onPick: (index: number) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Chapters" eyebrow={book.title}>
      <ol className="chapter-list">
        {book.chapters.map((chapter, i) => (
          <li key={i}>
            <button type="button" aria-current={i === current ? "true" : undefined} onClick={() => onPick(i)}>
              <span className="chapter-number" aria-hidden="true">
                {i + 1}
              </span>
              <span className="chapter-name">{chapter.title}</span>
              <span className="chapter-detail">{detail(i)}</span>
              {i === current && <span className="visually-hidden"> (current chapter)</span>}
            </button>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

/** Bookmarks in this book: go to one, remove one, or add one at the current place. */
export function BookmarksDialog({
  open,
  onClose,
  bookmarks,
  hereLabel,
  isHereMarked,
  onAdd,
  onGo,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  /** Where a new bookmark would go, e.g. "Chapter 3, page 2". */
  hereLabel: string;
  isHereMarked: boolean;
  onAdd: () => Promise<void>;
  onGo: (bookmark: Bookmark) => void;
  onRemove: (bookmark: Bookmark) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = "bookmark-error";

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Bookmarks" description={<p>Private to your account.</p>}>
      <button
        type="button"
        className="primary-button bookmark-add"
        disabled={busy || isHereMarked}
        aria-describedby={error ? errorId : undefined}
        onClick={() => attempt(onAdd)}
      >
        <Icon name="bookmark" size={18} filled={isHereMarked} />
        {isHereMarked ? `${hereLabel} is bookmarked` : `Bookmark ${hereLabel}`}
      </button>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {bookmarks.length === 0 ? (
        <p className="muted bookmark-empty">No bookmarks in this book yet.</p>
      ) : (
        <ul className="bookmark-list">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <button type="button" className="bookmark-go" onClick={() => onGo(b)}>
                <Icon name="bookmark" size={16} filled />
                <span>{b.label}</span>
                <small>{new Date(b.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
              </button>
              <button type="button" className="icon-button" disabled={busy} onClick={() => attempt(() => onRemove(b))}>
                <Icon name="trash" size={17} />
                <span className="visually-hidden">Remove bookmark {b.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** Shown once a book is marked finished. */
export function FinishedPanel({ book, onRestart }: { book: Book; onRestart: () => void }) {
  return (
    <div className="finished-panel" role="status">
      <span className="empty-icon">
        <Icon name="check" size={28} />
      </span>
      <h2>You finished {book.title}</h2>
      <p>It's in Finished in your library. Tell other readers what you thought.</p>
      <div className="reading-message-actions">
        <Link className="primary-button" to={`/books/${book.id}#logs`}>
          Write a log
        </Link>
        <Link className="secondary-button" to="/browse">
          Go to home
        </Link>
        <button type="button" className="text-button" onClick={onRestart}>
          Start again
        </button>
      </div>
    </div>
  );
}
