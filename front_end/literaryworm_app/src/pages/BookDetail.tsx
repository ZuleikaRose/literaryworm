import { bookLangTag } from "../lib/languages";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { BackLink } from "../components/BackLink";
import { UpNextButton } from "../components/UpNextButton";
import { FamilyShelfButton } from "../components/FamilyShelfButton";
import { BookSummary } from "../components/BookSummary";
import { OfflineBook } from "../components/OfflineBook";
import { RemindMe } from "../components/RemindMe";
import { MoodPicker } from "../components/MoodPicker";
import { StructuredData } from "../components/StructuredData";
import { bookData, bookRef, type Crumb, HOME_CRUMB, pageData } from "../lib/seo";
import { BuddyReadButton } from "../components/BuddyReadButton";
import { ContentNotes } from "../components/ContentNotes";
import { Dialog } from "../components/Dialog";
import { GooglePreview } from "../components/GooglePreview";
import { Icon } from "../components/Icon";
import { UploadRecordingLink } from "../components/UploadRecordingLink";
import { VoiceWholeBook } from "../components/VoiceWholeBook";
import { AskGrownUp } from "../components/AskGrownUp";
import { BookStatsSection } from "../components/BookStatsSection";
import { ReadingPlanSection } from "../components/ReadingPlanSection";
import { JournalSection } from "../components/JournalSection";
import { canAsk, mayOpen } from "../lib/bookRequests";
import { LogCard } from "../components/LogCard";
import { LogDialog } from "../components/LogDialog";
import { Shelf } from "../components/Shelf";
import { books, getBook, isAllowed } from "../data/books";
import { DEMO_UPCOMING_ID, demoUpcomingVolume } from "../data/demoUpcoming";
import { moreLike } from "../lib/recommend";
import { type BrowseGenre, genreForCategories } from "../data/genres";
import { readingStatusLabel } from "../data/logs";
import { type DetailView, fromCatalogBook, fromVolume } from "../lib/bookDetail";
import { usesBackend } from "../lib/backend";
import { fromLocal } from "../lib/booksApi";
import { ESSENTIAL } from "../lib/consent";
import { fallbackCover } from "../lib/coverFallback";
import { useBookFeed } from "../lib/useBookFeed";
import { usePublicLogs } from "../lib/usePublicLogs";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich, tk } from "../lib/i18n";
import { useVolume } from "../lib/useVolume";
import { AccountError, addLog, deleteLog, updateLog } from "../lib/accountApi";
import { personName, personPath } from "../lib/people";
import { lostWithBook } from "../lib/reading";
import { nextInSeries, seriesBooks, seriesPath, seriesPlace } from "../lib/series";
import { isOut } from "../lib/release";
import { useCollections } from "../lib/useCollections";
import { useLibrary } from "../lib/useLibrary";
import { finishDays, readsLine } from "../lib/rereads";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { AgeRating, Book, Profile, RatingValue, ReadingLog, ReadingStatus } from "../types";
import NotFound from "./NotFound";
import { AdultGate } from "../components/AdultGate";
import { adultGate, visitorIsAdult } from "../lib/adultGate";

/** Google Books volume ids and Open Library's `ol-OL…W` (the same check the books Edge Function makes). */
const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * /books/:id, public. Catalog titles come from the sample catalog; any other id is a Google
 * Books volume, fetched through the `books` Edge Function. Logs from every reader are listed
 * below, from Supabase and from this session.
 */
export default function BookDetail() {
  const id = useParams().id ?? "";
  const { state } = useStore();
  const profile = useActiveProfile();
  const local = getBook(id);
  const isVolume = !local && VOLUME_ID.test(id);
  // Kids profiles only see the LiteraryWorm catalog, so a Google title isn't even fetched.
  const kidsBlocked = isVolume && profile?.ageRating === "kids";
  // The demo's sample upcoming book (data/demoUpcoming.ts) is drawn here, never fetched.
  const demoUpcoming = Boolean(state.account?.isDemo) && id === DEMO_UPCOMING_ID && profile?.ageRating !== "kids";
  const { state: volume, retry } = useVolume(isVolume && !kidsBlocked && !demoUpcoming ? id : null);
  const profileData = useProfileData();
  const requests = profileData.bookRequests;
  // Bumped when a visitor confirms they're 18 or older, so the page shows the book (lib/adultGate.ts).
  const [, setPassed] = useState(0);

  if (!local && !isVolume) return <NotFound />;
  if (kidsBlocked || (local && profile && !mayOpen(local, profile, requests))) {
    return <NotOnShelf profile={profile!} book={local} />;
  }
  if (local) return <DetailPage key={id} view={fromCatalogBook(local)} />;
  if (demoUpcoming) return <DetailPage key={id} view={fromVolume(demoUpcomingVolume())} />;

  if (!volume || volume.status === "loading") return <DetailSkeleton />;
  if (volume.status === "error") {
    return volume.code === "not_found" ? <NotFound /> : <DetailError message={volume.message} onRetry={retry} />;
  }
  const gate = adultGate({
    mature: volume.volume.mature,
    ageRating: profile?.ageRating ?? null,
    profileConfirmedAt: profileData.matureOkAt ?? null,
    visitorConfirmed: visitorIsAdult(),
  });
  if (gate === "blocked") return <NotOnShelf profile={profile!} />;
  if (gate === "gate") return <AdultGate onConfirmed={() => setPassed((n) => n + 1)} />;
  return <DetailPage key={id} view={fromVolume(volume.volume)} />;
}

function NotOnShelf({ profile, book }: { profile: Profile; book?: Book }) {
  const t = useT();
  useTitle(t("Not on this shelf"));
  return (
    <section className="page empty-state">
      <span className="empty-icon">
        <Icon name="lock" size={28} />
      </span>
      <h1>{t("This book isn't on {name}'s shelf", { name: profile.name })}</h1>
      <p>
        {profile.ageRating === "kids"
          ? t("Kids profiles show books picked for younger readers. Ask a grown-up if you'd like this one.")
          : t("This title is rated for adults. A grown-up can open it from their own profile.")}
      </p>
      {book && <AskGrownUp book={book} />}
      <Link className={book && canAsk(book, profile) ? "secondary-button" : "primary-button"} to="/browse">
        {t("Go to home")}
      </Link>
    </section>
  );
}

function DetailSkeleton() {
  const t = useT();
  return (
    <div className="detail-page" aria-busy="true">
      <p className="visually-hidden" role="status">
        {t("Loading book details")}
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
  const t = useT();
  useTitle(t("Book details"));
  return (
    <section className="page empty-state" role="alert">
      <span className="empty-icon">
        <Icon name="alert" size={28} />
      </span>
      <h1>{t("We couldn't load this book")}</h1>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        {t("Try again")}
      </button>
    </section>
  );
}

function DetailCover({ view }: { view: DetailView }) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  if (view.coverUrl && !broken) {
    return (
      <span className="book-cover cover-xl cover-photo">
        <img {...ESSENTIAL} src={view.coverUrl} alt={t("Cover of {title}", { title: view.title })} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </span>
    );
  }
  const author = view.authors.join(", ") || t("Unknown author");
  const book = view.local ?? { cover: fallbackCover(view.id), genres: view.categories.slice(0, 1), title: view.title, author };
  return <Cover book={book} size="xl" />;
}

/** A book page's own node: an ItemPage about the book, with the trail through its series if it has one. */
function bookPageData(view: DetailView) {
  const path = `/books/${encodeURIComponent(view.id)}`;
  const crumbs: Crumb[] = [HOME_CRUMB];
  const place = view.local?.source === "literaryworm" ? seriesPlace(view.id) : null;
  if (place) crumbs.push({ name: place.series.name, path: seriesPath(place.series.name) });
  crumbs.push({ name: view.title, path });
  const mainEntity =
    view.local?.source === "literaryworm"
      ? bookRef(view.id)
      : { "@type": "Book", name: view.title, ...(view.authors.length ? { author: view.authors.map((name) => ({ "@type": "Person", name })) } : {}) };
  return pageData({ type: "ItemPage", path, name: view.title, crumbs, mainEntity });
}

type Pending = { kind: "remove" } | { kind: "deleteLog"; log: ReadingLog } | null;

function DetailPage({ view }: { view: DetailView }) {
  useTitle(view.title);
  const t = useT();
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
    place && !place.finished && place.format === format ? Math.round(place.fraction * 100) : null;
  const canWriteLogs = Boolean(profile && profile.ageRating !== "kids");
  // "Your 2nd read" / "Read twice" (lib/rereads.ts, from the profile's finish days).
  const reads = profile ? readsLine(entry, finishDays(data.readingDays, view.id)) : "";
  const author = view.authors.join(", ") || t("Unknown author");

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
      setActionError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
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
      library.add({ bookId: view.id, title: view.title, authors: view.authors, cover: view.coverUrl, published: view.release?.date ?? null }, status),
    );
    if (ok) setAnnouncement(t("Added {title} to your library.", { title: view.title }));
  }

  async function removeFromLibrary() {
    const hadLogs = myLogCount > 0;
    setPending(null);
    const ok = await attempt(() => library.remove(view.id));
    if (!ok) return;
    // The database deleted this reader's logs with the book; show the list without them.
    if (userId && hadLogs) remote.reload();
    focusTarget.current = "library-action";
    setAnnouncement(
      hadLogs
        ? t("Removed {title} and your logs about it.", { title: view.title })
        : t("Removed {title} from your library.", { title: view.title }),
    );
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
    if (ok) setAnnouncement(editing ? t("Your log is updated.") : t("Log published. Readers can now find it on this page."));
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
      setAnnouncement(t("Your log is deleted."));
    }
  }

  async function rate(value: RatingValue) {
    if (!requireProfile()) return;
    const next = rating === value ? null : value;
    if (await attempt(() => collections.rate(view.id, next))) setAnnouncement(next ? t("Rating saved.") : t("Rating cleared."));
  }

  async function toggleFavorite() {
    if (!requireProfile()) return;
    const ok = await attempt(() => collections.toggleFavorite(view.id));
    if (ok) setAnnouncement(favorite ? t("Removed from your favorites.") : t("Added to your favorites."));
  }

  const longDescription = (view.description?.length ?? 0) > 700;
  const description = view.description ?? t("No description is available for this book yet.");

  return (
    <div className="detail-page">
      <BackLink />
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      {/* A LiteraryWorm title's own schema.org data (lib/seo.ts); Google Books titles and uploads have none. */}
      {view.local?.source === "literaryworm" && <StructuredData id="book" data={bookData(view.local)} />}
      {/* Every book page but an upload's (private) says what it is and where it sits. */}
      {!view.local?.upload && <StructuredData id="page" data={bookPageData(view)} />}

      <section className="book-hero" aria-labelledby="book-title">
        <div className="detail-cover">
          <DetailCover view={view} />
        </div>
        <div className="book-info">
          {view.kicker && <p className="eyebrow">{view.kicker}</p>}
          {/* A classic in another language is read out in that language (Google's titles keep the page's). */}
          <h1 id="book-title" lang={view.local?.language ? bookLangTag(view.local.language) : undefined}>
            {view.title}
          </h1>
          {view.subtitle && <p className="book-subtitle">{view.subtitle}</p>}
          {view.local && <SeriesLine bookId={view.id} />}
          <p className="byline">
            {rich(t("by {authors}"), {
              authors: view.authors.length ? (
              view.authors.map((name, i) => (
                <span key={name}>
                  {i > 0 && ", "}
                  {/* Names the books function can't search for (unusual characters) aren't linked. */}
                  {personName(name) === name ? (
                    <Link className="byline-link" to={personPath("author", name)}>
                      {name}
                    </Link>
                  ) : (
                    <strong>{name}</strong>
                  )}
                </span>
              ))
            ) : (
              <strong>{author}</strong>
            ),
            })}
          </p>
          <ul className="book-meta" aria-label={t("At a glance")}>
            {view.averageRating !== null && (
              <li className="meta-rating">
                <Icon name="star" size={16} filled />
                <span>
                  {view.averageRating.toFixed(1)}
                  <span className="visually-hidden"> {t("out of 5 average rating")}</span>
                </span>
              </li>
            )}
            {view.ratingsCount !== null && (
              <li>
                {t.plural(view.ratingsCount, { one: "{count} rating", other: "{count} ratings" }, { count: view.ratingsCount.toLocaleString() })}
              </li>
            )}
            {view.pageCount !== null && <li>{t("{n} pages", { n: view.pageCount.toLocaleString() })}</li>}
            <li>
              {t.plural(logs.length, { one: "{count} log", other: "{count} logs" })}
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
              {descriptionOpen ? t("Show less") : t("Read the full description")}
              <Icon name="chevronDown" size={14} className={descriptionOpen ? "flip" : undefined} />
            </button>
          )}

          {view.local && profile && (
            <div className="detail-actions">
              {view.local.formats.includes("ebook") && (
                <Link className="primary-button" to={`/read/${view.id}`}>
                  <Icon name="bookOpen" size={18} /> {resume("ebook") !== null ? t("Continue reading · {percent}%", { percent: resume("ebook")! }) : t("Read")}
                </Link>
              )}
              {view.local.formats.includes("audiobook") && (
                <Link className="secondary-button" to={`/listen/${view.id}`}>
                  <Icon name="headphones" size={18} /> {resume("audiobook") !== null ? t("Continue listening · {percent}%", { percent: resume("audiobook")! }) : t("Listen")}
                </Link>
              )}
              <UpNextButton book={view.local} />
              <FamilyShelfButton bookId={view.local.id} />
              <BuddyReadButton book={view.local} />
            </div>
          )}
          {view.local?.upload && profile && <UploadRecordingLink upload={view.local} />}
          {/* Uploads and the classics (it shows only where natural voices are offered). */}
          {(view.local?.upload || (view.local?.publicDomain && view.local.recording)) && profile && <VoiceWholeBook book={view.local} />}

          <div className="detail-actions">
            {entry ? (
              <>
                <label className="status-field">
                  <span className="visually-hidden">{t("Reading status")}</span>
                  <Icon name="bookmark" size={16} filled />
                  <select
                    className="status-select"
                    value={entry.status}
                    disabled={busy}
                    onChange={async (e) => {
                      const status = e.target.value as ReadingStatus;
                      if (await attempt(() => library.setStatus(view.id, status)))
                        setAnnouncement(t("Marked as {status}.", { status: t(readingStatusLabel[status]).toLowerCase() }));
                    }}
                  >
                    {Object.entries(readingStatusLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={14} />
                </label>
                {entry.status === "finished" && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={async () => {
                      if (await attempt(() => library.readAgain(view.id)))
                        setAnnouncement(t("Moved to Reading, from the start. Finishing it again counts as another read."));
                    }}
                  >
                    <Icon name="bookOpen" size={17} /> {t("Read again")}
                  </button>
                )}
                {canWriteLogs && (
                  <button type="button" className="secondary-button" onClick={() => setWriting({})}>
                    <Icon name="edit" size={17} /> {t("Write a log")}
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => (removeWarning ? setPending({ kind: "remove" }) : removeFromLibrary())}
                >
                  <Icon name="trash" size={16} /> {t("Remove from library")}
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
                <Icon name="bookmark" size={18} /> {busy ? t("Adding…") : t("Add to my library")}
              </button>
            )}
          </div>

          {reads && <p className="book-reads">{reads}</p>}

          {profile && view.release && !isOut(view.release.date) && <RemindMe view={view} release={view.release} />}

          {actionError && (
            <div className="form-alert detail-error" role="alert">
              <Icon name="alert" size={17} />
              <p>{actionError}</p>
            </div>
          )}

          {profile && (
            <div className="taste-row" role="group" aria-label={t("Your rating")}>
              {(
                [
                  ["not-for-me", tk("Not for me"), "thumbDown"],
                  ["like", tk("I like this"), "thumbUp"],
                  ["love", tk("I love this"), "heart"],
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
                  <Icon name={icon} size={16} filled={rating === value} /> {t(label)}
                </button>
              ))}
              <button
                type="button"
                className="taste-button"
                aria-pressed={favorite}
                disabled={busy}
                onClick={toggleFavorite}
              >
                <Icon name="star" size={16} filled={favorite} /> {t("Favorite")}
              </button>
            </div>
          )}
          {profile && <MoodPicker bookId={view.id} />}
          {view.local && usesBackend && <ContentNotes bookId={view.id} />}

          <p className="privacy-note">
            <Icon name="lock" size={15} />
            {!profile
              ? t("Sign in to save books and write logs. Your library is private; logs are public.")
              : !entry && canWriteLogs
                ? t("Add this book to your library to write a log about it. Your library is private; logs are public.")
                : canWriteLogs
                  ? t("Your library and reading status are private. Logs you publish are public.")
                  : t("Your library is private. Kids profiles can read logs but don't post them.")}
          </p>
        </div>
      </section>

      {/* Members and the demo household; the summaries come from the backend. */}
      {profile && usesBackend && <BookSummary bookId={view.id} title={view.title} />}

      {/* Public-domain titles only: their text and audio may be kept on the device. */}
      {profile && view.local?.recording && <OfflineBook book={view.local} />}

      {view.preview && <GooglePreview id={view.id} title={view.title} kind={view.preview} />}

      {view.facts.length > 0 && (
        <section className="book-facts" aria-labelledby="facts-title">
          <h2 id="facts-title">{t("Book details")}</h2>
          <dl>
            {view.facts.map((fact) => (
              <div key={fact.label} className={fact.wide ? "fact-wide" : undefined}>
                <dt>{fact.label}</dt>
                <dd>
                  {fact.narrator && fact.value.includes(fact.narrator) ? (
                    <>
                      {fact.value.slice(0, fact.value.indexOf(fact.narrator))}
                      <Link to={personPath("narrator", fact.narrator)}>{fact.narrator}</Link>
                      {fact.value.slice(fact.value.indexOf(fact.narrator) + fact.narrator.length)}
                    </>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {view.googleLink && (
            <p className="source-credit">
              {rich(t("Details from {source}"), {
                source: (
                  <a href={view.googleLink} target="_blank" rel="noopener noreferrer">
                    {view.sourceName}
                    <Icon name="external" size={13} />
                    <span className="visually-hidden"> {t("(opens in a new tab)")}</span>
                  </a>
                ),
              })}
            </p>
          )}
        </section>
      )}

      {profile && <BookStatsSection bookId={view.id} at={place?.fraction ?? null} finished={Boolean(place?.finished)} />}

      {profile && (
        <ReadingPlanSection bookId={view.id} title={view.title} pages={view.pageCount} at={place?.fraction ?? 0} finished={Boolean(place?.finished)} />
      )}

      {profile && <JournalSection bookId={view.id} title={view.title} />}

      <section className="logs-section" id="logs" aria-labelledby="logs-title">
        <div className="logs-intro">
          <p className="eyebrow">{t("Community notes")}</p>
          <h2 id="logs-title" tabIndex={-1}>
            {t("Reader logs")}
          </h2>
          <p>{t("Ideas, reactions and moments worth remembering from people reading this book.")}</p>
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
              {t("Loading reader logs…")}
            </p>
          )}
          {remote.status === "error" && (
            <div className="logs-status" role="alert">
              <p>{remote.error}</p>
              <button type="button" className="secondary-button" onClick={remote.retry}>
                {t("Try again")}
              </button>
            </div>
          )}
          {remote.status === "idle" && (
            <button type="button" className="secondary-button logs-more" onClick={remote.loadMore}>
              {t("Load more logs")}
            </button>
          )}
          {remote.status !== "loading" && remote.status !== "error" && logs.length === 0 && (
            <div className="logs-empty">
              <Icon name="edit" size={22} />
              <p>
                {t("No logs yet.")}{" "}
                {canWriteLogs ? (entry ? t("Be the first to write one.") : t("Add it to your library to write the first.")) : null}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="detail-more">
        {view.local ? (
          <>
            <SeriesShelf bookId={view.id} ageRating={profile?.ageRating ?? "all"} />
            <CatalogMoreLikeThis view={view} ageRating={profile?.ageRating ?? "all"} />
          </>
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
        title={pending?.kind === "remove" ? t("Remove {title}?", { title: view.title }) : t("Delete this log?")}
        description={
          <p>
            {pending?.kind === "remove" ? removeWarning : t("It will disappear from this book's page. This can't be undone.")}
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
            {pending?.kind === "remove" ? t("Remove book") : t("Delete log")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setPending(null)}>
            {t("Keep it")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** "Book 2 of 6 in Anne of Green Gables", linking to the series page. */
function SeriesLine({ bookId }: { bookId: string }) {
  const t = useT();
  const place = seriesPlace(bookId);
  if (!place) return null;
  const link = <Link to={seriesPath(place.series.name)}>{place.series.name}</Link>;
  return (
    <p className="book-subtitle">
      {place.total > 1
        ? rich(t("Book {position} of {total} in {series}"), { position: place.position, total: place.total, series: link })
        : rich(t("Part of {series}"), { series: link })}
    </p>
  );
}

/** The rest of the series, with what comes next first. */
function SeriesShelf({ bookId, ageRating }: { bookId: string; ageRating: AgeRating }) {
  const t = useT();
  const place = seriesPlace(bookId);
  if (!place || place.total < 2) return null;
  const next = nextInSeries(bookId, ageRating);
  const items = seriesBooks(place.series, ageRating).filter((b) => b.id !== bookId);
  if (!items.length) return null;
  return (
    <Shelf
      id="series"
      eyebrow={next ? t("Next in the series: {title}", { title: next.title }) : t("The series")}
      title={place.series.name}
      items={items.map(fromLocal)}
      action={
        <Link className="secondary-button" to={seriesPath(place.series.name)}>
          {t("See the series")}
        </Link>
      }
    />
  );
}

function CatalogMoreLikeThis({ view, ageRating }: { view: DetailView; ageRating: AgeRating }) {
  const t = useT();
  const book = getBook(view.id);
  const allowed = books.filter((b) => isAllowed(b.ageRating, ageRating));
  // Closest first: shared genres, then the same author or series (lib/recommend.ts).
  const similar = (book ? moreLike(book, allowed, new Set()) : allowed.filter((b) => b.id !== view.id && b.genres.some((g) => view.categories.includes(g))).slice(0, 12)).map(fromLocal);
  if (!similar.length) return null;
  return <Shelf id="more-like-this" title={t("More like this")} items={similar} />;
}

function GoogleMoreLikeThis({ view, ageRating }: { view: DetailView; ageRating: AgeRating }) {
  const genre = genreForCategories(view.categories);
  return genre ? <GenreMoreLikeThis id={view.id} genre={genre} ageRating={ageRating} /> : null;
}

function GenreMoreLikeThis({ id, genre, ageRating }: { id: string; genre: BrowseGenre; ageRating: AgeRating }) {
  const t = useT();
  const feed = useBookFeed(genre === "technology" ? { mode: "home" } : { mode: "genre", genre }, ageRating);
  return (
    <Shelf
      id="more-like-this"
      title={t("More like this")}
      items={feed.items.filter((b) => b.id !== id)}
      status={feed.status}
      error={feed.error}
      onLoadMore={feed.loadMore}
      onRetry={feed.retry}
    />
  );
}
