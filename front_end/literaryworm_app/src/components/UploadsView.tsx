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
import { dateLocale } from "../lib/i18n";
import { useT } from "../lib/useT";

/**
 * My Library → Uploads: EPUBs this profile added. Each is read in the browser (its text only)
 * and opens in the reader like any book, with progress, bookmarks and highlights. Not for Kids
 * profiles.
 */
export function UploadsView({ profile }: { profile: Profile }) {
  const t = useT();
  // English keeps the device's own date and number style; other languages write them their way.
  const locale = t.lang === "en" ? undefined : dateLocale(t.lang);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const { state } = useStore();
  const { uploads, add, remove, canUpload } = useUploads();
  const [params, setParams] = useSearchParams();
  const sort = readUploadSort(params.get("sort"));
  const sortId = useId();
  const progress = activeReading(state).progress;
  // "Recently changed" is when the book was last read, else when it was uploaded.
  const sorted = sortUploads(uploads, sort, (u) => progress[u.id]?.updatedAt ?? u.createdAt);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UploadedBook | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const errorId = useId();
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
        <h3>{t("Uploads are for grown-ups and teens")}</h3>
        <p>{t("{name}'s profile shows books picked for younger readers, so it can't add its own.", { name: profile.name })}</p>
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
      setBusy(take.length === 1 ? t("Reading the EPUB…") : t("Reading {n} of {total}…", { n: i + 1, total: take.length }));
      try {
        added.push((await add(file)).title);
      } catch (err) {
        const reason = err instanceof Error ? err.message : t("couldn't be read. Try another file.");
        failed.push({ name: file.name, reason: t("couldn't be added ({reason})", { reason: reason.replace(/\.$/, "") }) });
        // The profile is full: the rest would fail the same way.
        if (/up to 50/.test(reason)) {
          for (const rest of take.slice(i + 1)) failed.push({ name: rest.name, reason: t("wasn't added (this profile has 50 uploads)") });
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
        <h2 id="upload-title">{t("Add a book you own")}</h2>
        <p className="goal-hint" id={hintId}>
          {remote
            ? t("Choose up to {max} EPUBs without DRM at a time, each up to 50 MB. LiteraryWorm keeps their text only, privately for {name}. Upload only books you have the right to read.", {
                max: UPLOADS_AT_ONCE,
                name: profile.name,
              })
            : t("Choose up to {max} EPUBs without DRM at a time, each up to 50 MB. LiteraryWorm keeps their text only, privately for {name} in this tab: the demo forgets it when you refresh. Upload only books you have the right to read.", {
                max: UPLOADS_AT_ONCE,
                name: profile.name,
              })}
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
          {busy ?? t("Choose EPUBs")}
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
          <h3>{t("No uploads yet")}</h3>
          <p>{t("Books you add show here and open in the reader, with your place, bookmarks and highlights kept like any book.")}</p>
        </div>
      ) : (
        <>
          <form className="upload-search" role="search" aria-label={t("Your uploads")} onSubmit={submitSearch} noValidate>
            <div className="upload-search-row">
              <div className="upload-search-by">
                <label htmlFor={`${searchId}-by`}>{t("Search by")}</label>
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
                      {t(b.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="upload-search-field">
                <label htmlFor={searchId}>
                  {searchBy === "keywords" ? t("Keywords") : searchBy === "author" ? t("Author's name") : byIsbn ? t("ISBN") : t("Title")}
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
                  <Icon name="search" size={15} /> {t("Search")}
                </button>
              )}
              {(draft || keywordSearch) && (
                <button type="button" className="ghost-button small-button" onClick={clearSearch}>
                  {t("Clear")}
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
                  ? (isbnNote ?? t("The 10- or 13-digit number from the book. Google Books says which book it is, and your uploads with that title and author show."))
                  : searchBy === "keywords"
                    ? t("Looks for every word in your books' text, titles, authors and part names, and shows where they are. It's done on this device.")
                    : searchBy === "author"
                      ? t("Shows your uploads whose author has every word you type.")
                      : t("Shows your uploads whose title has every word you type.")}
              </p>
            )}
            {uploads.length > 1 && (
              <div className="upload-sort library-sort">
                <label htmlFor={sortId}>{t("Sort by")}</label>
                <select
                  id={sortId}
                  className="field-input"
                  value={sort}
                  onChange={(e) => {
                    // From the address as it is now, so a quick second change keeps the first.
                    const next = new URLSearchParams(window.location.search);
                    if (e.target.value === "added") next.delete("sort");
                    else next.set("sort", e.target.value);
                    setParams(next, { replace: true });
                  }}
                >
                  {UPLOAD_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {t(s.label)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="visually-hidden" role="status">
              {keywordSearch
                ? keywordSearch.status === "searching"
                  ? t("Searching {searched} of {total} books…", { searched: keywordSearch.searched, total: keywordSearch.total })
                  : t.plural(keywordSearch.found.length, { one: "{count} book has “{q}”.", other: "{count} books have “{q}”." }, { q: keywordSearch.q })
                : byIsbn && isbnNote
                  ? isbnNote
                  : draft
                  ? t("{shown} of {total} uploads shown.", { shown: shown.length, total: uploads.length })
                  : ""}
            </p>
          </form>
          {keywordSearch && (
            <p className="upload-search-summary" aria-hidden="true">
              {keywordSearch.status === "searching"
                ? t("Searching {searched} of {total} books…", { searched: keywordSearch.searched, total: keywordSearch.total })
                : keywordSearch.found.length === 0
                  ? t("No uploads have every word of “{q}”. Try fewer words.", { q: keywordSearch.q })
                  : t.plural(keywordSearch.found.length, { one: "{count} book has “{q}”.", other: "{count} books have “{q}”." }, { q: keywordSearch.q })}
            </p>
          )}
          {keywordSearch && keywordSearch.failed.length > 0 && (
            <p className="field-hint">
              {t.plural(
                keywordSearch.failed.length,
                { one: "Couldn't search {names}: its text didn't load. Check your connection and search again.", other: "Couldn't search {names}: their text didn't load. Check your connection and search again." },
                { names: keywordSearch.failed.join(", ") },
              )}
            </p>
          )}
          {!keywordSearch && !byIsbn && draft && shown.length === 0 && (
            <p className="upload-search-summary">{t("No uploads match. Check the spelling, or search by keywords.")}</p>
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
                    <span>{u.author || t("Unknown author")}</span>
                    <small>
                      {t.plural(u.chapterTitles.length, { one: "{count} part", other: "{count} parts" })} ·{" "}
                      {t("{n} words", { n: u.words.toLocaleString(locale) })} · {t("added {date}", { date: dateFormat.format(u.createdAt) })}
                      {place && ` · ${place.finished ? t("finished") : t("{n}% read", { n: Math.round(place.fraction * 100) })}`}
                    </small>
                    {found && <KeywordHits upload={u} result={found} />}
                  </div>
                  <div className="library-row-actions">
                    <Link
                      className="primary-button small-button"
                      to={`/read/${u.id}`}
                    >
                      <Icon name="bookOpen" size={15} />{" "}
                      {place && !place.finished ? t("Continue") : t("Read")}
                      <span className="visually-hidden"> {u.title}</span>
                    </Link>
                    <button
                      type="button"
                      className="ghost-button small-button"
                      onClick={() => setRemoving(u)}
                    >
                      <Icon name="trash" size={15} /> {t("Delete")}
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
        title={t("Delete this book?")}
        description={
          <p>{t("{title} goes, with your place, bookmarks and highlights in it. You can upload it again.", { title: removing?.title ?? "" })}</p>
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
                setDone(t("{title} was deleted.", { title: target.title }));
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : t("We couldn't delete the book. Try again."),
                );
              }
            }}
          >
            {t("Delete book")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRemoving(null)}
          >
            {t("Keep it")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** Where a keyword search found the words in one upload, each a link to that page in the reader. */
function KeywordHits({ upload, result }: { upload: UploadedBook; result: KeywordResult }) {
  const t = useT();
  if (result.count === 0) return <p className="upload-hits-note">{t("Found in its title, author or part names.")}</p>;
  const more = result.count - result.hits.length;
  return (
    <>
      <ul className="upload-hits" role="list">
        {result.hits.map((hit, i) => (
          <li key={i}>
            <Link to={hitPath(upload.id, hit)}>
              <span className="upload-hit-where">{upload.chapterTitles[hit.chapterIndex] || t("Part {n}", { n: hit.chapterIndex + 1 })}</span>
              <span className="upload-hit-text">
                {hit.before}
                <mark>{hit.match}</mark>
                {hit.after}
              </span>
              <span className="visually-hidden">{t(", open {title} here", { title: upload.title })}</span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="upload-hits-note">
          {t.plural(more, { one: "And {count} more place in this book.", other: "And {count} more places in this book." }, { count: more.toLocaleString(t.lang === "en" ? undefined : dateLocale(t.lang)) })}
        </p>
      )}
    </>
  );
}
