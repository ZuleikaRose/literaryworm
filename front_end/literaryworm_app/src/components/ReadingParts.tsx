import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { nextInSeries } from "../lib/series";
import { Link, useParams } from "react-router-dom";
import { useUploadedBook } from "../lib/uploads";
import { getBook } from "../data/books";
import { mayOpen } from "../lib/bookRequests";
import { EXTRA_MINUTES } from "../lib/useDailyLimit";
import { BEDTIME_EXTRA_MINUTES, timeLabel } from "../lib/bedtime";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { Book, Bookmark, Format, PlanId } from "../types";
import { AccountPasswordField } from "./AccountPasswordField";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { nextPlanUp, planCheckoutPath } from "../lib/planLimits";
import { dateLocale, rich } from "../lib/i18n";
import { useT } from "../lib/useT";

/** A full-screen message in place of the reader or player. */
export function ReadingMessage({ title, icon, children, action }: { title: string; icon: "lock" | "bookOpen" | "clock" | "headphones" | "moon"; children: ReactNode; action?: ReactNode }) {
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
  const requests = useProfileData().bookRequests;
  // When the page opened; enough to tell whether a cancelled plan's end date has passed.
  const [openedAt] = useState(() => Date.now());
  const t = useT();

  // A paused membership, or one whose cancellation date has passed, doesn't open books.
  if (account?.status === "paused") {
    return (
      <ReadingMessage
        title={t("Your membership is paused")}
        icon="clock"
        action={
          <Link className="primary-button" to="/account#plan">
            {t("Resume in Account")}
          </Link>
        }
      >
        <p>{t("Reading and listening start again as soon as the membership is resumed. Your place in every book is saved.")}</p>
      </ReadingMessage>
    );
  }
  if (account?.status === "cancelled" || (account?.endsAt && Date.parse(account.endsAt) <= openedAt)) {
    return (
      <ReadingMessage
        title={t("Your membership has ended")}
        icon="lock"
        action={
          <Link className="primary-button" to="/pricing">
            {t("Choose a plan")}
          </Link>
        }
      >
        <p>{t("Choose a plan to keep reading. Your library and your place in every book are still here.")}</p>
      </ReadingMessage>
    );
  }

  if (!book) {
    return (
      <ReadingMessage
        title={format === "ebook" ? t("You can't read this book here") : t("You can't listen to this book here")}
        icon="bookOpen"
        action={
          <Link className="primary-button" to={id ? `/books/${id}` : "/browse"}>
            {id ? t("Back to the book") : t("Go to home")}
          </Link>
        }
      >
        <p>{t("LiteraryWorm can open only its own titles. Books from Google Books can be saved to your library and logged, but not read or played here.")}</p>
      </ReadingMessage>
    );
  }
  if (profile && !mayOpen(book, profile, requests)) {
    return (
      <ReadingMessage title={t("This book isn't on {name}'s shelf", { name: profile.name })} icon="lock" action={<Link className="primary-button" to="/browse">{t("Go to home")}</Link>}>
        <p>
          {profile.ageRating === "kids"
            ? t("Kids profiles show books picked for younger readers. Ask a grown-up if you'd like this one.")
            : t("This title is rated for adults. A grown-up can open it from their own profile.")}
        </p>
      </ReadingMessage>
    );
  }
  if (!book.formats.includes(format)) {
    return (
      <ReadingMessage
        title={format === "ebook" ? t("{title} has no ebook", { title: book.title }) : t("{title} has no audiobook", { title: book.title })}
        icon="bookOpen"
        action={
          <Link className="primary-button" to={`/${format === "ebook" ? "listen" : "read"}/${book.id}`}>
            {format === "ebook" ? t("Listen instead") : t("Read instead")}
          </Link>
        }
      >
        <p>{format === "ebook" ? t("It's available as an audiobook only.") : t("It's available as an ebook only.")}</p>
      </ReadingMessage>
    );
  }
  return <>{children(book)}</>;
}

/** Shown once the profile's daily limit is used up. A grown-up can allow 30 more minutes. */
/** The plan's audiobook hours for the month are used up (Basic 5, Standard 30); reading carries on. */
export function ListeningAllowanceUsed({
  planId,
  planName,
  hours,
  resumesOn,
  bookId,
  share = null,
}: {
  share?: number | null;
  planId: PlanId | null;
  planName: string;
  hours: number;
  resumesOn: string;
  bookId: string;
}) {
  // One tap to the next plan's checkout (Plans opens it from ?plan=).
  const next = nextPlanUp(planId);
  const t = useT();
  if (share !== null) {
    return (
      <ReadingMessage
        title={t("That's this month's listening")}
        icon="headphones"
        action={
          <div className="reading-message-actions">
            <Link className="primary-button" to={`/read/${bookId}`}>
              {t("Read it instead")}
            </Link>
          </div>
        }
      >
        <p>
          {t("This profile's share of the household's audiobooks is {hours} hours a month, and it's used up. Listening starts again on {date}, and your place is saved. A grown-up can change the share in Account → Family.", {
            hours: share,
            date: resumesOn,
          })}
        </p>
      </ReadingMessage>
    );
  }
  return (
    <ReadingMessage
      title={t("That's this month's listening")}
      icon="headphones"
      action={
        <div className="reading-message-actions">
          {next ? (
            <Link className="primary-button" to={planCheckoutPath(next)}>
              {next.audioHoursPerMonth === null
                ? t("Move to {plan}: unlimited listening", { plan: next.name })
                : t("Move to {plan}: {hours} hours", { plan: next.name, hours: next.audioHoursPerMonth })}
            </Link>
          ) : (
            <Link className="primary-button" to="/pricing">
              {t("See plans")}
            </Link>
          )}
          <Link className="secondary-button" to={`/read/${bookId}`}>
            {t("Read it instead")}
          </Link>
        </div>
      }
    >
      <p>
        {t(
          "Your {plan} plan includes {hours} hours of audiobooks a month for the whole household, and they're used up. Listening starts again on {date}, and your place is saved. Reading has no limit, and a bigger plan has more hours.",
          { plan: planName, hours, date: resumesOn },
        )}
      </p>
    </ReadingMessage>
  );
}

/**
 * Today's time is used up, or (with `wake`) it's a Kids profile's bedtime (lib/bedtime.ts): the book
 * waits, and a grown-up's password allows more (30 minutes, or 15 past bedtime).
 */
export function DailyLimitReached({ limitMinutes, wake = null, onAllowMore }: { limitMinutes: number | null; wake?: string | null; onAllowMore: () => void }) {
  const profile = useActiveProfile();
  const checkPassword = useCheckAccountPassword();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const t = useT();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await checkPassword(password);
    setBusy(false);
    if (result.ok) {
      onAllowMore();
      return;
    }
    setError(result.problem ?? t("That's not the account password. Try again."));
    field.current?.focus();
  };

  const minutes = limitMinutes ?? 0;
  const hours = minutes >= 60 ? t.plural(minutes / 60, { one: "{count} hour", other: "{count} hours" }) : t("{minutes} minutes", { minutes });
  const extra = wake ? BEDTIME_EXTRA_MINUTES : EXTRA_MINUTES;
  return (
    <ReadingMessage
      title={wake ? t("Time for bed") : t("That's today's reading time")}
      icon={wake ? "moon" : "clock"}
      action={
        !asking && (
          <div className="reading-message-actions">
            <Link className="primary-button" to="/browse">
              {t("Go to home")}
            </Link>
            <button type="button" className="secondary-button" onClick={() => setAsking(true)}>
              {t("Ask a grown-up for more time")}
            </button>
          </div>
        )
      }
    >
      {wake ? (
        <p>
          {profile
            ? t("It's {name}'s bedtime. Your place is saved, so you can pick up here from {time}. Sleep well.", { name: profile.name, time: timeLabel(wake) })
            : t("It's this profile's bedtime. Your place is saved, so you can pick up here from {time}. Sleep well.", { time: timeLabel(wake) })}
        </p>
      ) : (
        <p>
          {profile
            ? t("{name} can read and listen for {hours} a day. Your place is saved, so you can pick up here tomorrow.", { name: profile.name, hours })
            : t("This profile can read and listen for {hours} a day. Your place is saved, so you can pick up here tomorrow.", { hours })}
        </p>
      )}
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
              {busy ? t("Checking…") : t("Allow {n} more minutes", { n: extra })}
            </button>
            <button type="button" className="secondary-button" onClick={() => setAsking(false)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}
    </ReadingMessage>
  );
}

/** Asked when the progress bar reaches the end, so a stray drag doesn't finish the book. */
export function MarkFinishedDialog({ open, title, onFinish, onCancel }: { open: boolean; title: string; onFinish: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onCancel} title={t("Mark as finished?")} size="sm" description={<p>{t("{title} will move to Finished in your library and leave Continue reading.", { title })}</p>}>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          {t("Not yet")}
        </button>
        <button type="button" className="primary-button" onClick={onFinish}>
          <Icon name="check" size={18} /> {t("Mark as finished")}
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
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Chapters")} eyebrow={book.title}>
      <ol className="chapter-list">
        {book.chapters.map((chapter, i) => (
          <li key={i}>
            <button type="button" aria-current={i === current ? "true" : undefined} onClick={() => onPick(i)}>
              <span className="chapter-number" aria-hidden="true">
                {i + 1}
              </span>
              <span className="chapter-name">{chapter.title}</span>
              <span className="chapter-detail">{detail(i)}</span>
              {i === current && <span className="visually-hidden"> {t("(current chapter)")}</span>}
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
  const t = useT();

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("Bookmarks")} description={<p>{t("Private to your account.")}</p>}>
      <button
        type="button"
        className="primary-button bookmark-add"
        disabled={busy || isHereMarked}
        aria-describedby={error ? errorId : undefined}
        onClick={() => attempt(onAdd)}
      >
        <Icon name="bookmark" size={18} filled={isHereMarked} />
        {isHereMarked ? t("{place} is bookmarked", { place: hereLabel }) : t("Bookmark {place}", { place: hereLabel })}
      </button>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {bookmarks.length === 0 ? (
        <p className="muted bookmark-empty">{t("No bookmarks in this book yet.")}</p>
      ) : (
        <ul className="bookmark-list">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <button type="button" className="bookmark-go" onClick={() => onGo(b)}>
                <Icon name="bookmark" size={16} filled />
                <span>{b.label}</span>
                <small>{new Date(b.createdAt).toLocaleDateString(dateLocale(t.lang), { day: "numeric", month: "short" })}</small>
              </button>
              <button type="button" className="icon-button" disabled={busy} onClick={() => attempt(() => onRemove(b))}>
                <Icon name="trash" size={17} />
                <span className="visually-hidden">{t("Remove bookmark {label}", { label: b.label })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** Shown once a book is marked finished. */
export function FinishedPanel({
  book,
  onRestart,
  upNext = null,
}: {
  book: Book;
  onRestart: () => void;
  /** The player's Up next: the first queued book and Play it. */
  upNext?: { book: Book; play: () => void } | null;
}) {
  const profile = useActiveProfile();
  const next = nextInSeries(book.id, profile?.ageRating ?? "all");
  const t = useT();
  return (
    <div className="finished-panel" role="status">
      <span className="empty-icon">
        <Icon name="check" size={28} />
      </span>
      <h2>{t("You finished {title}", { title: book.title })}</h2>
      <p>{t("It's in Finished in your library. Tell other readers what you thought.")}</p>
      {upNext && (
        <p className="finished-next">
          <button type="button" className="primary-button" onClick={upNext.play}>
            <Icon name="play" size={16} filled /> {t("Play next: {title}", { title: upNext.book.title })}
          </button>
        </p>
      )}
      {next && (
        <p className="finished-next">
          {rich(t("Next in the series: {link}"), { link: <Link to={`/books/${next.id}`}>{next.title}</Link> })}
        </p>
      )}
      <div className="reading-message-actions">
        <Link className="primary-button" to={`/books/${book.id}#logs`}>
          {t("Write a log")}
        </Link>
        <Link className="secondary-button" to="/browse">
          {t("Go to home")}
        </Link>
        <button type="button" className="text-button" onClick={onRestart}>
          {t("Start again")}
        </button>
      </div>
    </div>
  );
}
