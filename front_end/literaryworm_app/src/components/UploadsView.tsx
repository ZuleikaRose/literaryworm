import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { activeReading } from "../store/reducer";
import { useStore } from "../store/context";
import type { Profile, UploadedBook } from "../types";
import { readUploadSort, sortUploads, UPLOAD_SORTS } from "../lib/librarySort";
import { uploadToBook } from "../lib/uploads";
import { useUploads } from "../lib/useUploads";
import { batchSummary, planBatch, type Skipped, UPLOADS_AT_ONCE } from "../lib/uploadBatch";
import { detailsMatch, hitPath, type KeywordResult, UPLOAD_SEARCH_BY, uploadQueryError, type UploadSearchBy } from "../lib/uploadSearch";
import { useUploadSearch } from "../lib/useUploadSearch";
import { usesBackend } from "../lib/booksApi";
import { isbnMatches, uploadChoice } from "../lib/clubBookChoices";
import { normalizeQuery, queryError } from "../lib/search";
import { isbnNoteFor, useIsbnLookup } from "../lib/useIsbnLookup";
import { Cover } from "./Cover";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * My Library → Uploads: EPUBs this profile added. Each is read in the browser (its text only)
 * and opens in the reader like any book, with progress, bookmarks and highlights. Not for Kids
 * profiles.
 */
export function UploadsView({ profile }: { profile: Profile }) {
  const { state } = useStore();
  const { uploads, add, remove, canUpload } = useUploads();
  const [params, setParams] = useSearchParams();
  const sort = readUploadSort(params.get("sort"));
  const sortId = useId();
  const sorted = sortUploads(uploads, sort);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UploadedBook | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const errorId = useId();
  const progress = activeReading(state).progress;
  const remote = Boolean(state.account?.userId);
  const searchId = useId();
  const [searchBy, setSearchBy] = useState<UploadSearchBy>("title");
  const [draft, setDraft] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const keywords = useUploadSearch();
  const searchInput = useRef<HTMLInputElement>(null);
  // ISBNs are looked up on Google Books, so only with LiteraryWorm's servers (as on Search).
  const searchChoices = UPLOAD_SEARCH_BY.filter((b) => b.value !== "isbn" || usesBackend);
  const byIsbn = searchBy === "isbn";
  const lookup = useIsbnLookup(byIsbn ? draft : "");
  const isbnShown = !normalizeQuery(draft)
    ? sorted
    : lookup.editions
      ? sorted.filter((u) => isbnMatches([uploadChoice(u)], lookup.editions!).length > 0)
      : [];
  // Until it's a whole ISBN, say what's wrong with it; then what Google Books says it is.
  const isbnNote = !byIsbn || !normalizeQuery(draft) ? null : lookup.isbn ? isbnNoteFor(lookup, isbnShown.length, "uploads") : queryError(normalizeQuery(draft), "isbn");
  // Title, author and ISBN narrow the list as the reader types; keywords search the text when asked.
  const shown = searchBy === "keywords" ? sorted : byIsbn ? isbnShown : sorted.filter((u) => detailsMatch(u, draft, searchBy));
  const keywordSearch = searchBy === "keywords" ? keywords.search : null;
  const resultFor = new Map(keywordSearch?.found.map((f) => [f.upload.id, f.result]));
  const listed = keywordSearch ? sorted.filter((u) => resultFor.has(u.id)) : shown;

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchBy !== "keywords") return;
    const problem = uploadQueryError(draft);
    setSearchError(problem);
    if (problem) {
      searchInput.current?.focus();
      return;
    }
    void keywords.start(sorted, draft);
  };

  const clearSearch = () => {
    setDraft("");
    setSearchError(null);
    keywords.clear();
    searchInput.current?.focus();
  };

  if (!canUpload) {
    return (
      <div className="library-empty">
        <Icon name="lock" size={28} />
        <h3>Uploads are for grown-ups and teens</h3>
        <p>
          {profile.name}'s profile shows books picked for younger readers, so it
          can't add its own.
        </p>
      </div>
    );
  }

  // Up to UPLOADS_AT_ONCE EPUBs per choice, each up to 50 MB, read one after another.
  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setDone(null);
    const { take, skipped, overLimit } = planBatch(files);
    const added: string[] = [];
    const failed: Skipped[] = [...skipped];
    for (const [i, file] of take.entries()) {
      setBusy(take.length === 1 ? "Reading the EPUB…" : `Reading ${i + 1} of ${take.length}…`);
      try {
        added.push((await add(file)).title);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "couldn't be read. Try another file.";
        failed.push({ name: file.name, reason: `couldn't be added (${reason.replace(/\.$/, "")})` });
        // The profile is full: the rest would fail the same way.
        if (/up to 50/.test(reason)) {
          for (const rest of take.slice(i + 1)) failed.push({ name: rest.name, reason: "wasn't added (this profile has 50 uploads)" });
          break;
        }
      }
    }
    setBusy(null);
    const summary = batchSummary(added, failed, overLimit);
    setDone(summary.done);
    setError(summary.problem);
    if (summary.problem) button.current?.focus();
  };

  return (
    <div className="uploads">
      <section className="goal-card upload-card" aria-labelledby="upload-title">
        <h2 id="upload-title">Add a book you own</h2>
        <p className="goal-hint" id={hintId}>
          Choose up to {UPLOADS_AT_ONCE} EPUBs without DRM at a time, each up to 50 MB. LiteraryWorm keeps their text
          only, privately for {profile.name}
          {remote ? "" : " in this tab: the demo forgets it when you refresh"}.
          Upload only books you have the right to read.
        </p>
        <button
          ref={button}
          type="button"
          className="primary-button small-button"
          disabled={busy !== null}
          aria-describedby={[hintId, error ? errorId : null]
            .filter(Boolean)
            .join(" ")}
          onClick={() => input.current?.click()}
        >
          <Icon name="plus" size={15} />{" "}
          {busy ?? "Choose EPUBs"}
        </button>
        {/* The button opens it; it isn't reached on its own. */}
        <input
          ref={input}
          type="file"
          accept=".epub,application/epub+zip"
          multiple
          hidden
          tabIndex={-1}
          onChange={choose}
        />
        <p className="visually-hidden" role="status">
          {busy ?? done ?? ""}
        </p>
        {error && (
          <p className="field-error" id={errorId} role="alert">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
        {done && (
          <p className="form-success">
            <Icon name="check" size={16} /> {done}
          </p>
        )}
      </section>

      {uploads.length === 0 ? (
        <div className="library-empty">
          <Icon name="bookOpen" size={28} />
          <h3>No uploads yet</h3>
          <p>
            Books you add show here and open in the reader, with your place,
            bookmarks and highlights kept like any book.
          </p>
        </div>
      ) : (
        <>
          <form className="upload-search" role="search" aria-label="Your uploads" onSubmit={submitSearch} noValidate>
            <div className="upload-search-row">
              <div className="upload-search-by">
                <label htmlFor={`${searchId}-by`}>Search by</label>
                <select
                  id={`${searchId}-by`}
                  className="field-input"
                  value={searchBy}
                  onChange={(e) => {
                    setSearchBy(e.target.value as UploadSearchBy);
                    setSearchError(null);
                    keywords.clear();
                  }}
                >
                  {searchChoices.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="upload-search-field">
                <label htmlFor={searchId}>
                  {searchBy === "keywords" ? "Keywords" : searchBy === "author" ? "Author's name" : byIsbn ? "ISBN" : "Title"}
                </label>
                <input
                  ref={searchInput}
                  id={searchId}
                  className="field-input"
                  type="search"
                  value={draft}
                  maxLength={200}
                  autoComplete="off"
                  inputMode={byIsbn ? "numeric" : undefined}
                  aria-invalid={searchError ? true : undefined}
                  aria-describedby={searchError ? `${searchId}-error` : `${searchId}-hint`}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSearchError(null);
                  }}
                />
              </div>
              {searchBy === "keywords" && (
                <button type="submit" className="primary-button small-button" disabled={keywordSearch?.status === "searching"}>
                  <Icon name="search" size={15} /> Search
                </button>
              )}
              {(draft || keywordSearch) && (
                <button type="button" className="ghost-button small-button" onClick={clearSearch}>
                  Clear
                </button>
              )}
            </div>
            {searchError ? (
              <p className="field-error" id={`${searchId}-error`}>
                <Icon name="alert" size={15} /> {searchError}
              </p>
            ) : (
              <p className="field-hint" id={`${searchId}-hint`}>
                {byIsbn
                  ? (isbnNote ?? "The 10- or 13-digit number from the book. Google Books says which book it is, and your uploads with that title and author show.")
                  : searchBy === "keywords"
                    ? "Looks for every word in your books' text, titles, authors and part names, and shows where they are. It's done on this device."
                    : `Shows your uploads whose ${searchBy === "author" ? "author" : "title"} has every word you type.`}
              </p>
            )}
            <p className="visually-hidden" role="status">
              {keywordSearch
                ? keywordSearch.status === "searching"
                  ? `Searching ${keywordSearch.searched} of ${keywordSearch.total} books…`
                  : `${keywordSearch.found.length} ${keywordSearch.found.length === 1 ? "book has" : "books have"} “${keywordSearch.q}”.`
                : byIsbn && isbnNote
                  ? isbnNote
                  : draft
                  ? `${shown.length} of ${uploads.length} uploads shown.`
                  : ""}
            </p>
          </form>
          {keywordSearch && (
            <p className="upload-search-summary" aria-hidden="true">
              {keywordSearch.status === "searching"
                ? `Searching ${keywordSearch.searched} of ${keywordSearch.total} books…`
                : keywordSearch.found.length === 0
                  ? `No uploads have every word of “${keywordSearch.q}”. Try fewer words.`
                  : `${keywordSearch.found.length} ${keywordSearch.found.length === 1 ? "book has" : "books have"} “${keywordSearch.q}”.`}
            </p>
          )}
          {keywordSearch && keywordSearch.failed.length > 0 && (
            <p className="field-hint">
              Couldn't search {keywordSearch.failed.join(", ")}: {keywordSearch.failed.length === 1 ? "its text" : "their text"} didn't
              load. Check your connection and search again.
            </p>
          )}
          {!keywordSearch && !byIsbn && draft && shown.length === 0 && (
            <p className="upload-search-summary">No uploads match. Check the spelling, or search by keywords.</p>
          )}
          {uploads.length > 1 && (
            <div className="library-controls">
              <div className="library-sort">
                <label htmlFor={sortId}>Sort by</label>
                <select
                  id={sortId}
                  className="field-input"
                  value={sort}
                  onChange={(e) => {
                    const next = new URLSearchParams(params);
                    if (e.target.value === "uploaded") next.delete("sort");
                    else next.set("sort", e.target.value);
                    setParams(next, { replace: true });
                  }}
                >
                  {UPLOAD_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <ul className="library-list" role="list">
            {listed.map((u) => {
              const book = uploadToBook(u);
              const place = progress[u.id];
              const found = resultFor.get(u.id);
              return (
                <li key={u.id} className="library-row">
                  <span className="library-row-cover" aria-hidden="true">
                    <Cover book={book} size="sm" />
                  </span>
                  <div className="library-row-copy">
                    <Link to={`/read/${u.id}`} className="library-row-title">
                      {u.title}
                    </Link>
                    <span>{u.author || "Unknown author"}</span>
                    <small>
                      {u.chapterTitles.length}{" "}
                      {u.chapterTitles.length === 1 ? "part" : "parts"} ·{" "}
                      {u.words.toLocaleString()} words · added{" "}
                      {dateFormat.format(u.createdAt)}
                      {place &&
                        ` · ${place.finished ? "finished" : `${Math.round(place.fraction * 100)}% read`}`}
                    </small>
                    {found && <KeywordHits upload={u} result={found} />}
                  </div>
                  <div className="library-row-actions">
                    <Link
                      className="primary-button small-button"
                      to={`/read/${u.id}`}
                    >
                      <Icon name="bookOpen" size={15} />{" "}
                      {place && !place.finished ? "Continue" : "Read"}
                      <span className="visually-hidden"> {u.title}</span>
                    </Link>
                    <button
                      type="button"
                      className="ghost-button small-button"
                      onClick={() => setRemoving(u)}
                    >
                      <Icon name="trash" size={15} /> Delete
                      <span className="visually-hidden"> {u.title}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        title="Delete this book?"
        description={
          <p>
            {removing?.title} goes, with your place, bookmarks and highlights in
            it. You can upload it again.
          </p>
        }
      >
        <div className="modal-actions">
          <button
            type="button"
            className="danger-button"
            onClick={async () => {
              const target = removing;
              setRemoving(null);
              if (!target) return;
              setError(null);
              setDone(null);
              try {
                await remove(target);
                setDone(`${target.title} was deleted.`);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "We couldn't delete the book. Try again.",
                );
              }
            }}
          >
            Delete book
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRemoving(null)}
          >
            Keep it
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** Where a keyword search found the words in one upload, each a link to that page in the reader. */
function KeywordHits({ upload, result }: { upload: UploadedBook; result: KeywordResult }) {
  if (result.count === 0) return <p className="upload-hits-note">Found in its title, author or part names.</p>;
  const more = result.count - result.hits.length;
  return (
    <>
      <ul className="upload-hits" role="list">
        {result.hits.map((hit, i) => (
          <li key={i}>
            <Link to={hitPath(upload.id, hit)}>
              <span className="upload-hit-where">{upload.chapterTitles[hit.chapterIndex] || `Part ${hit.chapterIndex + 1}`}</span>
              <span className="upload-hit-text">
                {hit.before}
                <mark>{hit.match}</mark>
                {hit.after}
              </span>
              <span className="visually-hidden">, open {upload.title} here</span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="upload-hits-note">
          And {more.toLocaleString()} more {more === 1 ? "place" : "places"} in this book.
        </p>
      )}
    </>
  );
}
