import { type FormEvent, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookSummary } from "../components/BookSummary";
import { ClubsView } from "../components/ClubsView";
import { Cover } from "../components/Cover";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { GoalsView } from "../components/GoalsView";
import { Icon } from "../components/Icon";
import { SavedBookTile } from "../components/SavedBookTile";
import { getBook, isAllowed } from "../data/books";
import { readingStatusLabel } from "../data/logs";
import { AccountError } from "../lib/accountApi";
import { usesBackend } from "../lib/backend";
import { LIST_BOOKS_MAX, LIST_DESCRIPTION_MAX, LIST_NAME_MAX, LISTS_MAX, shareUrl } from "../lib/collections";
import { fallbackCover } from "../lib/coverFallback";
import { useCollections } from "../lib/useCollections";
import { useLibrary } from "../lib/useLibrary";
import { useTitle } from "../lib/useTitle";
import { useVolume } from "../lib/useVolume";
import { useActiveProfile } from "../store/context";
import type { CustomList, LibraryEntry, Profile, ReadingStatus } from "../types";

type View = "library" | "favorites" | "lists" | "goals" | "clubs";
type StatusFilter = ReadingStatus | "all";

const VIEWS: { id: View; label: string }[] = [
  { id: "library", label: "My library" },
  { id: "favorites", label: "Favorites" },
  { id: "lists", label: "Lists" },
  { id: "goals", label: "Goals" },
  { id: "clubs", label: "Clubs" },
];

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Kids profiles see only catalog titles rated for them; everyone else sees the whole library. */
function visibleTo(profile: Profile, bookId: string): boolean {
  if (profile.ageRating === "all") return true;
  const book = getBook(bookId);
  return book ? isAllowed(book.ageRating, profile.ageRating) : profile.ageRating !== "kids";
}

/**
 * /library: the brief's library (want to read, reading, finished), private to the account,
 * plus the blueprint's Favorites and custom lists.
 */
export default function Library() {
  useTitle("My Library");
  const profile = useActiveProfile()!;
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.some((v) => v.id === params.get("view")) ? (params.get("view") as View) : "library";

  return (
    <div className="library-page page-content">
      <header className="library-header">
        <h1>My Library</h1>
        <p>Private to you{profile.ageRating === "kids" ? `, showing ${profile.name}'s books` : ""}. Logs you publish are public.</p>
      </header>
      <nav className="library-tabs" aria-label="Library sections">
        <ul role="list">
          {VIEWS.map((v) => (
            <li key={v.id}>
              <Link
                to={v.id === "library" ? "/library" : `/library?view=${v.id}`}
                aria-current={v.id === view ? "page" : undefined}
                onClick={() => setParams(v.id === "library" ? {} : { view: v.id }, { replace: true })}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {view === "library" && <LibraryView profile={profile} />}
      {view === "favorites" && <FavoritesView profile={profile} />}
      {view === "lists" && <ListsView profile={profile} />}
      {view === "goals" && <GoalsView profile={profile} />}
      {view === "clubs" && <ClubsView profile={profile} />}
    </div>
  );
}

// --- My library ---------------------------------------------------------------

function LibraryView({ profile }: { profile: Profile }) {
  const library = useLibrary();
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const filter: StatusFilter = raw === "want_to_read" || raw === "reading" || raw === "finished" ? raw : "all";
  const [announcement, setAnnouncement] = useState("");
  const [removing, setRemoving] = useState<LibraryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const entries = Object.values(library.entries)
    .filter((e) => visibleTo(profile, e.bookId))
    .sort((a, b) => b.addedAt - a.addedAt);
  const counts = {
    all: entries.length,
    want_to_read: entries.filter((e) => e.status === "want_to_read").length,
    reading: entries.filter((e) => e.status === "reading").length,
    finished: entries.filter((e) => e.status === "finished").length,
  };
  const shown = filter === "all" ? entries : entries.filter((e) => e.status === filter);

  async function run(work: () => Promise<void>, done: string): Promise<boolean> {
    setError(null);
    try {
      await work();
      setAnnouncement(done);
      return true;
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
      return false;
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const entry = removing;
    setRemoving(null);
    if (await run(() => library.remove(entry.bookId), "Removed from your library.")) headingRef.current?.focus();
  }

  return (
    <section aria-labelledby="library-title">
      <h2 id="library-title" className="visually-hidden" tabIndex={-1} ref={headingRef}>
        My library
      </h2>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <fieldset className="filter-group library-filter">
        <legend>Show</legend>
        <div className="chip-group">
          {(["all", "want_to_read", "reading", "finished"] as const).map((s) => (
            <label key={s} className="chip">
              <input
                type="radio"
                name="library-status"
                checked={filter === s}
                onChange={() => setParams(s === "all" ? {} : { status: s }, { replace: true })}
              />
              <span>
                {s === "all" ? "All" : readingStatusLabel[s]} ({counts[s]})
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="library-empty">
          <Icon name="library" size={28} />
          <h3>{entries.length === 0 ? "Your library is empty" : `Nothing marked ${readingStatusLabel[filter as ReadingStatus].toLowerCase()}`}</h3>
          <p>
            {entries.length === 0
              ? "Open any book and choose Add to my library. Your library is private; only you see it."
              : "Change a book's status here or on its page."}
          </p>
          {entries.length === 0 && (
            <Link className="primary-button" to="/browse">
              Find a book
            </Link>
          )}
        </div>
      ) : (
        <ul className="library-list" role="list">
          {shown.map((entry) => (
            <LibraryRow
              key={entry.bookId}
              entry={entry}
              onStatus={(status) =>
                run(() => library.setStatus(entry.bookId, status), `Marked as ${readingStatusLabel[status].toLowerCase()}.`)
              }
              onRemove={() => setRemoving(entry)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        title="Remove this book?"
        description={<p>Any logs you wrote about it, your place in it and its bookmarks are deleted too. This can't be undone.</p>}
      >
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={confirmRemove}>
            Remove book
          </button>
          <button type="button" className="secondary-button" onClick={() => setRemoving(null)}>
            Keep it
          </button>
        </div>
      </Dialog>
    </section>
  );
}

/** Title, author and cover for an entry: the catalog, what was saved with it, or Google Books. */
function useEntryDetails(entry: Pick<LibraryEntry, "bookId" | "title" | "authors" | "cover">) {
  const book = getBook(entry.bookId);
  const needsLookup = !book && !entry.title;
  const { state } = useVolume(needsLookup ? entry.bookId : null);
  if (book) return { title: book.title, author: book.author, cover: null, local: book, loading: false };
  const volume = state?.status === "ready" ? state.volume : null;
  return {
    title: entry.title ?? volume?.title ?? (state?.status === "error" ? "Book details unavailable" : "Loading…"),
    author: (entry.authors ?? volume?.authors ?? []).join(", ") || "Unknown author",
    cover: entry.cover ?? volume?.cover ?? null,
    local: undefined,
    loading: needsLookup && state?.status === "loading",
  };
}

function SmallCover({ bookId, details }: { bookId: string; details: ReturnType<typeof useEntryDetails> }) {
  const [broken, setBroken] = useState(false);
  if (details.local) return <Cover book={details.local} size="sm" />;
  if (details.cover && !broken) {
    return (
      <span className="book-cover cover-sm cover-photo">
        <img src={details.cover} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  return <Cover book={{ cover: fallbackCover(bookId), genres: [], title: details.title, author: details.author }} size="sm" />;
}

function LibraryRow({
  entry,
  onStatus,
  onRemove,
}: {
  entry: LibraryEntry;
  onStatus: (status: ReadingStatus) => Promise<boolean>;
  onRemove: () => void;
}) {
  const details = useEntryDetails(entry);
  const selectId = useId();
  const [saving, setSaving] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  return (
    <li className="library-row" aria-busy={details.loading}>
      <Link to={`/books/${entry.bookId}`} className="library-row-cover" tabIndex={-1} aria-hidden="true">
        <SmallCover bookId={entry.bookId} details={details} />
      </Link>
      <div className="library-row-copy">
        <Link to={`/books/${entry.bookId}`} className="library-row-title">
          {details.title}
        </Link>
        <span>{details.author}</span>
        <small>Added {dateFormat.format(entry.addedAt)}</small>
      </div>
      <div className="library-row-actions">
        <label className="visually-hidden" htmlFor={selectId}>
          Reading status for {details.title}
        </label>
        <select
          id={selectId}
          className="status-select compact"
          value={entry.status}
          disabled={saving}
          onChange={async (e) => {
            setSaving(true);
            await onStatus(e.target.value as ReadingStatus);
            setSaving(false);
          }}
        >
          {Object.entries(readingStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {usesBackend && (
          <button type="button" className="ghost-button small-button" onClick={() => setSummaryOpen(true)}>
            <Icon name="bookOpen" size={15} /> Summary<span className="visually-hidden"> of {details.title}</span>
          </button>
        )}
        <button type="button" className="ghost-button small-button" onClick={onRemove}>
          <Icon name="trash" size={15} /> Remove<span className="visually-hidden"> {details.title}</span>
        </button>
      </div>
      {usesBackend && (
        <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} eyebrow="Written by AI" title={`${details.title}: summary`}>
          {/* Mounted only while open, so a summary is asked for only when someone wants it. */}
          {summaryOpen && <BookSummary bookId={entry.bookId} title={details.title} inDialog />}
        </Dialog>
      )}
    </li>
  );
}

// --- Favorites ----------------------------------------------------------------

function FavoritesView({ profile }: { profile: Profile }) {
  const { favorites } = useCollections();
  // Newest first; Kids profiles see only catalog titles rated for them.
  const shown = favorites.filter((id) => visibleTo(profile, id)).reverse();
  if (shown.length === 0) {
    return (
      <div className="library-empty">
        <Icon name="star" size={28} />
        <h3>No favorites yet</h3>
        <p>Choose Favorite on any book's page, from LiteraryWorm or Google Books, to keep it here.</p>
      </div>
    );
  }
  return (
    <ul className="catalog-grid library-grid" role="list">
      {shown.map((id) => (
        <SavedBookTile key={id} bookId={id} ageRating={profile.ageRating} />
      ))}
    </ul>
  );
}

// --- Custom lists -------------------------------------------------------------

function ListsView({ profile }: { profile: Profile }) {
  const collections = useCollections();
  const library = useLibrary();
  const [editing, setEditing] = useState<CustomList | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomList | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lists = collections.lists;
  const sharing = lists.find((l) => l.id === sharingId) ?? null;
  const libraryBooks = Object.values(library.entries).filter((e) => visibleTo(profile, e.bookId));

  /** Runs a save; a failure shows above the lists and changes nothing. */
  async function run(work: () => Promise<void>, done: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await work();
      setAnnouncement(done);
      return true;
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Moves a list, keeping keyboard focus on its move buttons even when one becomes disabled at an end. */
  async function move(list: CustomList, from: number, by: -1 | 1) {
    const to = from + by;
    if (!(await run(() => collections.moveList(list.id, by), `${list.name} moved to position ${to + 1} of ${lists.length}.`))) return;
    const atEnd = to === 0 || to === lists.length - 1;
    const keep = atEnd ? (by === -1 ? "down" : "up") : by === -1 ? "up" : "down";
    requestAnimationFrame(() => document.getElementById(`move-${keep}-${list.id}`)?.focus());
  }

  return (
    <section aria-labelledby="lists-title">
      <div className="lists-heading">
        <h2 id="lists-title" tabIndex={-1}>
          Your lists
        </h2>
        <button type="button" className="primary-button" disabled={lists.length >= LISTS_MAX} onClick={() => setEditing("new")}>
          <Icon name="plus" size={17} /> New list
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      {error && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="library-empty">
          <Icon name="list" size={28} />
          <h3>No lists yet</h3>
          <p>Make a list for a book club, a holiday stack or anything else, then add books from your library.</p>
        </div>
      ) : (
        <ol className="custom-lists" role="list">
          {lists.map((list, i) => (
            <li key={list.id} className="custom-list">
              <div className="custom-list-head">
                <div>
                  <h3 id={`list-${list.id}`}>
                    {list.name}
                    {list.shareSlug && (
                      <span className="shared-tag">
                        <Icon name="share" size={13} /> Shared
                      </span>
                    )}
                  </h3>
                  {list.description && <p>{list.description}</p>}
                  <small>
                    {list.bookIds.length} {list.bookIds.length === 1 ? "book" : "books"}
                  </small>
                </div>
                <div className="custom-list-actions">
                  <button
                    type="button"
                    id={`move-up-${list.id}`}
                    className="icon-button"
                    disabled={i === 0 || busy}
                    onClick={() => move(list, i, -1)}
                  >
                    <Icon name="chevronDown" size={18} className="flip" />
                    <span className="visually-hidden">Move {list.name} up</span>
                  </button>
                  <button
                    type="button"
                    id={`move-down-${list.id}`}
                    className="icon-button"
                    disabled={i === lists.length - 1 || busy}
                    onClick={() => move(list, i, 1)}
                  >
                    <Icon name="chevronDown" size={18} />
                    <span className="visually-hidden">Move {list.name} down</span>
                  </button>
                  {collections.canShare && (
                    <button type="button" className="ghost-button small-button" onClick={() => setSharingId(list.id)}>
                      <Icon name="share" size={15} /> Share<span className="visually-hidden"> {list.name}</span>
                    </button>
                  )}
                  <button type="button" className="ghost-button small-button" onClick={() => setEditing(list)}>
                    <Icon name="edit" size={15} /> Rename<span className="visually-hidden"> {list.name}</span>
                  </button>
                  <button type="button" className="ghost-button small-button danger-text" onClick={() => setDeleting(list)}>
                    <Icon name="trash" size={15} /> Delete<span className="visually-hidden"> {list.name}</span>
                  </button>
                </div>
              </div>
              <ListBooks list={list} libraryBooks={libraryBooks} busy={busy} run={run} />
            </li>
          ))}
        </ol>
      )}
      {lists.length > 0 && !collections.canShare && (
        <p className="list-hint">
          {collections.remote ? "Kids profiles can't share lists." : "Sharing a list by link needs a LiteraryWorm account; the demo can't publish links."}
        </p>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New list" : "Rename list"} size="sm">
        {editing !== null && (
          <ListForm
            initial={editing === "new" ? null : editing}
            taken={lists.filter((l) => editing === "new" || l.id !== editing.id).map((l) => l.name.toLowerCase())}
            onSave={async (name, description) => {
              if (editing === "new") await collections.createList(name, description);
              else await collections.updateList(editing.id, name, description);
              setAnnouncement(editing === "new" ? `Created ${name}.` : `Saved ${name}.`);
              setEditing(null);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        size="sm"
        title={`Delete ${deleting?.name ?? "this list"}?`}
        description={
          <p>
            The books stay in your library.{deleting?.shareSlug ? " Its shared link stops working." : ""} This can't be undone.
          </p>
        }
      >
        <div className="modal-actions">
          <button
            type="button"
            className="danger-button"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              const list = deleting;
              setDeleting(null);
              if (await run(() => collections.deleteList(list.id), `Deleted ${list.name}.`)) {
                requestAnimationFrame(() => document.getElementById("lists-title")?.focus());
              }
            }}
          >
            Delete list
          </button>
          <button type="button" className="secondary-button" onClick={() => setDeleting(null)}>
            Keep it
          </button>
        </div>
      </Dialog>

      <ShareDialog
        list={sharing}
        onClose={() => setSharingId(null)}
        onShare={(id) => collections.shareList(id)}
        onStop={(id) => collections.stopSharing(id)}
      />
    </section>
  );
}

function ListForm({
  initial,
  taken,
  onSave,
}: {
  initial: CustomList | null;
  taken: string[];
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const descId = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the list a name.");
    if (trimmed.length > LIST_NAME_MAX) return setError(`Names can be up to ${LIST_NAME_MAX} characters.`);
    if (taken.includes(trimmed.toLowerCase())) return setError("You already have a list with this name.");
    setSaving(true);
    try {
      await onSave(trimmed, description);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Field
        label="Name"
        value={name}
        maxLength={LIST_NAME_MAX + 10}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        error={error}
        autoComplete="off"
      />
      <div className="field">
        <label className="field-label" htmlFor={descId}>
          Description (optional)
        </label>
        <textarea
          id={descId}
          className="field-input"
          rows={3}
          maxLength={LIST_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="submit" className="primary-button modal-submit" disabled={saving}>
        {saving ? "Saving…" : initial ? "Save list" : "Create list"}
      </button>
    </form>
  );
}

/** Share a list by link, copy the link, or stop sharing (the link stops working at once). */
function ShareDialog({
  list,
  onClose,
  onShare,
  onStop,
}: {
  list: CustomList | null;
  onClose: () => void;
  onShare: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const linkId = useId();
  const link = list?.shareSlug ? shareUrl(list.shareSlug) : null;

  async function attempt(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      await work();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser didn't allow copying. Select the link and copy it yourself.");
    }
  }

  return (
    <Dialog
      open={list !== null}
      onClose={() => {
        setError(null);
        setCopied(false);
        onClose();
      }}
      size="sm"
      eyebrow="Share by link"
      title={list?.name ?? "Share list"}
      description={
        <p>
          Anyone with the link can see this list's name, description, your profile's name and its books. They never see your
          account, library or reading history.
        </p>
      }
    >
      {list && (
        <div className="share-panel">
          {link ? (
            <>
              <label className="field-label" htmlFor={linkId}>
                Link to this list
              </label>
              <div className="share-link-row">
                <input id={linkId} className="field-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="secondary-button" onClick={copy}>
                  <Icon name={copied ? "check" : "share"} size={16} /> {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="visually-hidden" role="status">
                {copied ? "Link copied." : ""}
              </p>
              <button type="button" className="text-button danger-text" disabled={busy} onClick={() => attempt(() => onStop(list.id))}>
                {busy ? "Stopping…" : "Stop sharing"}
              </button>
            </>
          ) : (
            <button type="button" className="primary-button" disabled={busy} onClick={() => attempt(() => onShare(list.id))}>
              <Icon name="share" size={16} /> {busy ? "Making a link…" : "Share by link"}
            </button>
          )}
          {error && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ListBooks({
  list,
  libraryBooks,
  busy,
  run,
}: {
  list: CustomList;
  libraryBooks: LibraryEntry[];
  busy: boolean;
  run: (work: () => Promise<void>, done: string) => Promise<boolean>;
}) {
  const { addToList, removeFromList } = useCollections();
  const [picked, setChoice] = useState("");
  const selectId = useId();
  const addable = libraryBooks.filter((e) => !list.bookIds.includes(e.bookId));
  // A book since removed from the library (or added already) can't stay chosen.
  const choice = addable.some((e) => e.bookId === picked) ? picked : "";
  const full = list.bookIds.length >= LIST_BOOKS_MAX;

  return (
    <div className="list-books">
      {list.bookIds.length > 0 && (
        <ul className="list-book-items" role="list" aria-labelledby={`list-${list.id}`}>
          {list.bookIds.map((bookId) => (
            <ListBookItem
              key={bookId}
              bookId={bookId}
              entry={libraryBooks.find((e) => e.bookId === bookId)}
              busy={busy}
              onRemove={(title) => run(() => removeFromList(list.id, bookId), `Removed ${title} from ${list.name}.`)}
            />
          ))}
        </ul>
      )}
      {addable.length > 0 && !full ? (
        <form
          className="list-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!choice) return;
            if (await run(() => addToList(list.id, choice), `Added to ${list.name}.`)) setChoice("");
          }}
        >
          <label className="field-label" htmlFor={selectId}>
            Add a book from your library
          </label>
          <div className="list-add-row">
            <select id={selectId} className="field-input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose a book</option>
              {addable.map((e) => (
                <BookOption key={e.bookId} entry={e} />
              ))}
            </select>
            <button type="submit" className="secondary-button" disabled={!choice || busy}>
              Add
            </button>
          </div>
        </form>
      ) : full ? (
        <p className="list-hint">This list is full: a list can hold up to {LIST_BOOKS_MAX} books.</p>
      ) : (
        list.bookIds.length === 0 && <p className="list-hint">Add books to your library first, then put them in this list.</p>
      )}
    </div>
  );
}

function BookOption({ entry }: { entry: LibraryEntry }) {
  const details = useEntryDetails(entry);
  return <option value={entry.bookId}>{details.title}</option>;
}

function ListBookItem({
  bookId,
  entry,
  busy,
  onRemove,
}: {
  bookId: string;
  entry?: LibraryEntry;
  busy: boolean;
  onRemove: (title: string) => void;
}) {
  const details = useEntryDetails(entry ?? { bookId });
  return (
    <li>
      <Link to={`/books/${bookId}`}>{details.title}</Link>
      <span>{details.author}</span>
      <button type="button" className="icon-button" disabled={busy} onClick={() => onRemove(details.title)}>
        <Icon name="close" size={15} />
        <span className="visually-hidden">Remove {details.title} from this list</span>
      </button>
    </li>
  );
}
