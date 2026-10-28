import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { BookSummary } from "../components/BookSummary";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { LogCard } from "../components/LogCard";
import { LogDialog } from "../components/LogDialog";
import { Shelf } from "../components/Shelf";
import { books, getBook, isAllowed } from "../data/books";
import { type BrowseGenre, genreForCategories } from "../data/genres";
import { readingStatusLabel } from "../data/logs";
import { type DetailView, fromCatalogBook, fromVolume } from "../lib/bookDetail";
import { usesBackend } from "../lib/backend";
import { fromLocal } from "../lib/booksApi";
import { fallbackCover } from "../lib/coverFallback";
import { useBookFeed } from "../lib/useBookFeed";
import { usePublicLogs } from "../lib/usePublicLogs";
import { useTitle } from "../lib/useTitle";
import { useVolume } from "../lib/useVolume";
import { AccountError, addLog, deleteLog, updateLog } from "../lib/accountApi";
import { lostWithBook } from "../lib/reading";
import { useCollections } from "../lib/useCollections";
import { useLibrary } from "../lib/useLibrary";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { AgeRating, Profile, RatingValue, ReadingLog, ReadingStatus } from "../types";
import NotFound from "./NotFound";

/** Google Books volume ids (the same check the books Edge Function makes). */
const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * /books/:id, public. Catalog titles come from the sample catalog; any other id is a Google
 * Books volume, fetched through the `books` Edge Function. Logs from every reader are listed
 * below, from Supabase and from this session.
 */
export default function BookDetail() {
  const id = useParams().id ?? "";
  const profile = useActiveProfile();
  const local = getBook(id);
  const isVolume = !local && VOLUME_ID.test(id);
  // Kids profiles only see the LiteraryWorm catalog, so a Google title isn't even fetched.
  const kidsBlocked = isVolume && profile?.ageRating === "kids";
  const { state: volume, retry } = useVolume(isVolume && !kidsBlocked ? id : null);

  if (!local && !isVolume) return <NotFound />;
  if (kidsBlocked || (local && profile && !isAllowed(local.ageRating, profile.ageRating))) {
    return <NotOnShelf profile={profile!} />;
  }
  if (local) return <DetailPage key={id} view={fromCatalogBook(local)} />;

  if (!volume || volume.status === "loading") return <DetailSkeleton />;
  if (volume.status === "error") {
    return volume.code === "not_found" ? <NotFound /> : <DetailError message={volume.message} onRetry={retry} />;
  }
  if (volume.volume.mature && profile && profile.ageRating !== "all") return <NotOnShelf profile={profile} />;
  return <DetailPage key={id} view={fromVolume(volume.volume)} />;
}

function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useStore();
  const home = state.activeProfileId ? "/browse" : "/";
  // Go back when there's somewhere in the app to go back to; otherwise (opened from a link) go home.
  const canGoBack = location.key !== "default";
  return (
    <Link
      className="back-button"
      to={home}
      onClick={(e) => {
        if (!canGoBack) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      <Icon name="arrowLeft" size={18} /> Back
    </Link>
  );
}

function NotOnShelf({ profile }: { profile: Profile }) {
  useTitle("Not on this shelf");
  return (
    <section className="page empty-state">
      <span className="empty-icon">
        <Icon name="lock" size={28} />
      </span>
      <h1>This book isn't on {profile.name}'s shelf</h1>
      <p>
        {profile.ageRating === "kids"
          ? "Kids profiles show books picked for younger readers. Ask a grown-up if you'd like this one."
          : "This title is rated for adults. A grown-up can open it from their own profile."}
      </p>
      <Link className="primary-button" to="/browse">
        Go to home
      </Link>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail-page" aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading book details
      </p>
      <div className="book-hero" aria-hidden="true">
        <div className="detail-cover">
          <span className="book-cover cover-xl skeleton-block" />
        </div>
        <div className="book-info">
          <span className="skeleton-line short" />
          <span className="skeleton-line title" />
          <span className="skeleton-line" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      </div>
    </div>
  );
}

function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  useTitle("Book details");
  return (
    <section className="page empty-state" role="alert">
      <span className="empty-icon">
        <Icon name="alert" size={28} />
      </span>
      <h1>We couldn't load this book</h1>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

function DetailCover({ view }: { view: DetailView }) {
  const [broken, setBroken] = useState(false);
  if (view.coverUrl && !broken) {
    return (
      <span className="book-cover cover-xl cover-photo">
        {/* Decorative: the title is the page heading. */}
        <img src={view.coverUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </span>
    );
  }
  const author = view.authors.join(", ") || "Unknown author";
  const book = view.local ?? { cover: fallbackCover(view.id), genres: view.categories.slice(0, 1), title: view.title, author };
  return <Cover book={book} size="xl" />;
}

type Pending = { kind: "remove" } | { kind: "deleteLog"; log: ReadingLog } | null;

function DetailPage({ view }: { view: DetailView }) {
  useTitle(view.title);
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const navigate = useNavigate();
  const location = useLocation();
  const remote = usePublicLogs(view.id);

  const [writing, setWriting] = useState<{ log?: ReadingLog } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [announcement, setAnnouncement] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  // Where focus goes when the control that opened a dialog no longer exists.
  const focusTarget = useRef<string | null>(null);

  // After each render, and after the dialog's own effect has closed it (child effects run first).
  useEffect(() => {
    if (!focusTarget.current) return;
    document.getElementById(focusTarget.current)?.focus();
    focusTarget.current = null;
  });

  const library = useLibrary();
  const collections = useCollections();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const userId = state.account?.userId;
  const entry = profile ? library.entries[view.id] : undefined;
  const rating = profile ? data.ratings[view.id] : undefined;
  const favorite = profile ? data.favorites.includes(view.id) : false;
  // Where the account stopped, for "Continue reading" / "Continue listening".
  const place = profile ? activeReading(state).progress[view.id] : undefined;
  const bookmarkCount = profile ? activeReading(state).bookmarks.filter((b) => b.bookId === view.id).length : 0;
  const highlightCount = profile ? activeReading(state).highlights.filter((h) => h.bookId === view.id).length : 0;
  const resume = (format: "ebook" | "audiobook") =>
    place && !place.finished && place.format === format ? ` · ${Math.round(place.fraction * 100)}%` : null;
  const canWriteLogs = Boolean(profile && profile.ageRating !== "kids");
  const author = view.authors.join(", ") || "Unknown author";

  // This session's logs (sample ones and any written here) plus everyone's from Supabase.
  const sessionLogs = state.logs.filter((l) => l.bookId === view.id);
  const logs = [...sessionLogs, ...remote.items].sort((a, b) => b.createdAt - a.createdAt);
  const isMine = (log: ReadingLog) =>
    Boolean(profile && ((log.profileId && log.profileId === profile.id) || (userId && log.userId === userId)));
  const myLogCount = logs.filter(isMine).length;
  const removeWarning = lostWithBook(myLogCount, Boolean(place), bookmarkCount, highlightCount);
  // Logs show the account's display name for real accounts (profiles.display_name), the profile's otherwise.
  const postingAs = userId ? state.account!.name : (profile?.name ?? "");

  /** Runs a save, showing a plain-words error beside the buttons if it fails. */
  async function attempt(work: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      return true;
    } catch (err) {
      setActionError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Visitors sign in first (then come back here); a signed-in account picks a profile. */
  function requireProfile(): boolean {
    if (profile) return true;
    const from = location.pathname;
    navigate(state.account ? "/profiles" : "/signin", { state: { from } });
    return false;
  }

  async function addToLibrary(status?: ReadingStatus) {
    if (!requireProfile()) return;
    const ok = await attempt(() =>
      library.add({ bookId: view.id, title: view.title, authors: view.authors, cover: view.coverUrl }, status),
    );
    if (ok) setAnnouncement(`Added ${view.title} to your library.`);
  }

  async function removeFromLibrary() {
    const hadLogs = myLogCount > 0;
    setPending(null);
    const ok = await attempt(() => library.remove(view.id));
    if (!ok) return;
    // The database deleted this reader's logs with the book; show the list without them.
    if (userId && hadLogs) remote.reload();
    focusTarget.current = "library-action";
    setAnnouncement(hadLogs ? `Removed ${view.title} and your logs about it.` : `Removed ${view.title} from your library.`);
  }

  async function saveLog(body: string, value: number | null) {
    const editing = writing?.log;
    const ok = await attempt(async () => {
      if (userId) {
        if (editing) await updateLog(editing.id, body, value);
        else await addLog(view.id, body, value);
        remote.reload();
      } else if (editing) {
        dispatch({ type: "updateLog", id: editing.id, body, rating: value });
      } else {
        dispatch({ type: "addLog", bookId: view.id, body, rating: value });
      }
    });
    setWriting(null);
    if (ok) setAnnouncement(editing ? "Your log is updated." : "Log published. Readers can now find it on this page.");
  }

  async function removeLog(log: ReadingLog) {
    setPending(null);
    const ok = await attempt(async () => {
      if (userId && log.userId) {
        await deleteLog(log.id);
        remote.reload();
      } else {
        dispatch({ type: "deleteLog", id: log.id });
      }
    });
    if (ok) {
      focusTarget.current = "logs-title";
      setAnnouncement("Your log is deleted.");
    }
  }

  async function rate(value: RatingValue) {
    if (!requireProfile()) return;
    const next = rating === value ? null : value;
    if (await attempt(() => collections.rate(view.id, next))) setAnnouncement(next ? "Rating saved." : "Rating cleared.");
  }

  async function toggleFavorite() {
    if (!requireProfile()) return;
    const ok = await attempt(() => collections.toggleFavorite(view.id));
    if (ok) setAnnouncement(favorite ? "Removed from your favorites." : "Added to your favorites.");
  }

  const longDescription = (view.description?.length ?? 0) > 700;
  const description = view.description ?? "No description is available for this book yet.";

  return (
    <div className="detail-page">
      <BackLink />
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <section className="book-hero" aria-labelledby="book-title">
        <div className="detail-cover">
          <DetailCover view={view} />
        </div>
        <div className="book-info">
          {view.kicker && <p className="eyebrow">{view.kicker}</p>}
          <h1 id="book-title">{view.title}</h1>
          {view.subtitle && <p className="book-subtitle">{view.subtitle}</p>}
          <p className="byline">
            by <strong>{author}</strong>
          </p>
          <ul className="book-meta" aria-label="At a glance">
            {view.averageRating !== null && (
              <li className="meta-rating">
                <Icon name="star" size={16} filled />
                <span>
                  {view.averageRating.toFixed(1)}
                  <span className="visually-hidden"> out of 5 average rating</span>
                </span>
              </li>
            )}
            {view.ratingsCount !== null && (
              <li>
                {view.ratingsCount.toLocaleString()} {view.ratingsCount === 1 ? "rating" : "ratings"}
              </li>
            )}
            {view.pageCount !== null && <li>{view.pageCount.toLocaleString()} pages</li>}
            <li>
              {logs.length} {logs.length === 1 ? "log" : "logs"}
              {remote.status === "idle" && "+"}
            </li>
          </ul>

          <div className={`book-blurb${longDescription && !descriptionOpen ? " is-clamped" : ""}`} id="book-description">
            {description.split(/\n{2,}|\n/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {longDescription && (
            <button
              type="button"
              className="text-button"
              aria-expanded={descriptionOpen}
              aria-controls="book-description"
              onClick={() => setDescriptionOpen((o) => !o)}
            >
              {descriptionOpen ? "Show less" : "Read the full description"}
              <Icon name="chevronDown" size={14} className={descriptionOpen ? "flip" : undefined} />
            </button>
          )}

          {view.local && profile && (
            <div className="detail-actions">
              {view.local.formats.includes("ebook") && (
                <Link className="primary-button" to={`/read/${view.id}`}>
                  <Icon name="bookOpen" size={18} /> {resume("ebook") ? `Continue reading${resume("ebook")}` : "Read"}
                </Link>
              )}
              {view.local.formats.includes("audiobook") && (
                <Link className="secondary-button" to={`/listen/${view.id}`}>
                  <Icon name="headphones" size={18} /> {resume("audiobook") ? `Continue listening${resume("audiobook")}` : "Listen"}
                </Link>
              )}
            </div>
          )}

          <div className="detail-actions">
            {entry ? (
              <>
                <label className="status-field">
                  <span className="visually-hidden">Reading status</span>
                  <Icon name="bookmark" size={16} filled />
                  <select
                    className="status-select"
                    value={entry.status}
                    disabled={busy}
                    onChange={async (e) => {
                      const status = e.target.value as ReadingStatus;
                      if (await attempt(() => library.setStatus(view.id, status)))
                        setAnnouncement(`Marked as ${readingStatusLabel[status].toLowerCase()}.`);
                    }}
                  >
                    {Object.entries(readingStatusLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={14} />
                </label>
                {canWriteLogs && (
                  <button type="button" className="secondary-button" onClick={() => setWriting({})}>
                    <Icon name="edit" size={17} /> Write a log
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => (removeWarning ? setPending({ kind: "remove" }) : removeFromLibrary())}
                >
                  <Icon name="trash" size={16} /> Remove from library
                </button>
              </>
            ) : (
              <button
                type="button"
                id="library-action"
                className="primary-button"
                disabled={busy}
                onClick={() => addToLibrary()}
              >
                <Icon name="bookmark" size={18} /> {busy ? "Adding…" : "Add to my library"}
              </button>
            )}
          </div>

          {actionError && (
            <div className="form-alert detail-error" role="alert">
              <Icon name="alert" size={17} />
              <p>{actionError}</p>
            </div>
          )}

          {profile && (
            <div className="taste-row" role="group" aria-label="Your rating">
              {(
                [
                  ["not-for-me", "Not for me", "thumbDown"],
                  ["like", "I like this", "thumbUp"],
                  ["love", "I love this", "heart"],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  className="taste-button"
                  aria-pressed={rating === value}
                  disabled={busy}
                  onClick={() => rate(value)}
                >
                  <Icon name={icon} size={16} filled={rating === value} /> {label}
                </button>
              ))}
              <button
                type="button"
                className="taste-button"
                aria-pressed={favorite}
                disabled={busy}
                onClick={toggleFavorite}
              >
                <Icon name="star" size={16} filled={favorite} /> Favorite
              </button>
            </div>
          )}

          <p className="privacy-note">
            <Icon name="lock" size={15} />
            {!profile
              ? "Sign in to save books and write logs. Your library is private; logs are public."
              : !entry && canWriteLogs
                ? "Add this book to your library to write a log about it. Your library is private; logs are public."
                : canWriteLogs
                  ? "Your library and reading status are private. Logs you publish are public."
                  : "Your library is private. Kids profiles can read logs but don't post them."}
          </p>
        </div>
      </section>

      {/* Members and the demo household; the summaries come from the backend. */}
      {profile && usesBackend && <BookSummary bookId={view.id} title={view.title} />}

      {view.facts.length > 0 && (
        <section className="book-facts" aria-labelledby="facts-title">
          <h2 id="facts-title">Book details</h2>
          <dl>
            {view.facts.map((fact) => (
              <div key={fact.label} className={fact.wide ? "fact-wide" : undefined}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          {view.googleLink && (
            <p className="source-credit">
              Details from{" "}
              <a href={view.googleLink} target="_blank" rel="noopener noreferrer">
                Google Books
                <Icon name="external" size={13} />
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </section>
      )}

      <section className="logs-section" id="logs" aria-labelledby="logs-title">
        <div className="logs-intro">
          <p className="eyebrow">Community notes</p>
          <h2 id="logs-title" tabIndex={-1}>
            Reader logs
          </h2>
          <p>Ideas, reactions and moments worth remembering from people reading this book.</p>
        </div>
        <div className="logs-list">
          {logs.map((log) => {
            const own = isMine(log);
            return (
              <LogCard
                key={log.id}
                log={log}
                onEdit={own ? () => setWriting({ log }) : undefined}
                onDelete={own ? () => setPending({ kind: "deleteLog", log }) : undefined}
              />
            );
          })}

          {remote.status === "loading" && (
            <p className="logs-status" role="status">
              Loading reader logs…
            </p>
          )}
          {remote.status === "error" && (
            <div className="logs-status" role="alert">
              <p>{remote.error}</p>
              <button type="button" className="secondary-button" onClick={remote.retry}>
                Try again
              </button>
            </div>
          )}
          {remote.status === "idle" && (
            <button type="button" className="secondary-button logs-more" onClick={remote.loadMore}>
              Load more logs
            </button>
          )}
          {remote.status !== "loading" && remote.status !== "error" && logs.length === 0 && (
            <div className="logs-empty">
              <Icon name="edit" size={22} />
              <p>
                No logs yet.{" "}
                {canWriteLogs ? (entry ? "Be the first to write one." : "Add it to your library to write the first.") : null}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="detail-more">
        {view.local ? (
          <CatalogMoreLikeThis view={view} ageRating={profile?.ageRating ?? "all"} />
        ) : (
          <GoogleMoreLikeThis view={view} ageRating={profile?.ageRating ?? "all"} />
        )}
      </div>

      {profile && (
        <LogDialog
          open={writing !== null}
          onClose={() => setWriting(null)}
          bookTitle={view.title}
          postingAs={postingAs}
          initial={writing?.log ? { body: writing.log.body, rating: writing.log.rating } : undefined}
          onSubmit={saveLog}
        />
      )}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        size="sm"
        title={pending?.kind === "remove" ? `Remove ${view.title}?` : "Delete this log?"}
        description={
          <p>
            {pending?.kind === "remove" ? removeWarning : "It will disappear from this book's page. This can't be undone."}
          </p>
        }
      >
        <div className="modal-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              if (pending?.kind === "remove") return removeFromLibrary();
              if (pending?.kind === "deleteLog") return removeLog(pending.log);
            }}
          >
            {pending?.kind === "remove" ? "Remove book" : "Delete log"}
          </button>
          <button type="button" className="secondary-button" onClick={() => setPending(null)}>
            Keep it
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function CatalogMoreLikeThis({ view, ageRating }: { view: DetailView; ageRating: AgeRating }) {
  const similar = books
    .filter((b) => b.id !== view.id && isAllowed(b.ageRating, ageRating) && b.genres.some((g) => view.categories.includes(g)))
    .slice(0, 12)
    .map(fromLocal);
  if (!similar.length) return null;
  return <Shelf id="more-like-this" title="More like this" items={similar} />;
}

function GoogleMoreLikeThis({ view, ageRating }: { view: DetailView; ageRating: AgeRating }) {
  const genre = genreForCategories(view.categories);
  return genre ? <GenreMoreLikeThis id={view.id} genre={genre} ageRating={ageRating} /> : null;
}

function GenreMoreLikeThis({ id, genre, ageRating }: { id: string; genre: BrowseGenre; ageRating: AgeRating }) {
  const feed = useBookFeed(genre === "technology" ? { mode: "home" } : { mode: "genre", genre }, ageRating);
  return (
    <Shelf
      id="more-like-this"
      title="More like this"
      items={feed.items.filter((b) => b.id !== id)}
      status={feed.status}
      error={feed.error}
      onLoadMore={feed.loadMore}
      onRetry={feed.retry}
    />
  );
}
