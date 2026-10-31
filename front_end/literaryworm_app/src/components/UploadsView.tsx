import { type ChangeEvent, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { activeReading } from "../store/reducer";
import { useStore } from "../store/context";
import type { Profile, UploadedBook } from "../types";
import { readUploadSort, sortUploads, UPLOAD_SORTS } from "../lib/librarySort";
import { uploadToBook } from "../lib/uploads";
import { useUploads } from "../lib/useUploads";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UploadedBook | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const errorId = useId();
  const progress = activeReading(state).progress;
  const remote = Boolean(state.account?.userId);

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

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setDone(null);
    if (!/\.epub$/i.test(file.name)) {
      setError("Choose an EPUB file (it ends in .epub).");
      button.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const upload = await add(file);
      setDone(`${upload.title} is ready to read.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't read that EPUB. Try another file.",
      );
      button.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="uploads">
      <section className="goal-card upload-card" aria-labelledby="upload-title">
        <h2 id="upload-title">Add a book you own</h2>
        <p className="goal-hint" id={hintId}>
          Choose an EPUB without DRM (up to 50 MB). LiteraryWorm keeps its text
          only, privately for {profile.name}
          {remote ? "" : " in this tab: the demo forgets it when you refresh"}.
          Upload only books you have the right to read.
        </p>
        <button
          ref={button}
          type="button"
          className="primary-button small-button"
          disabled={busy}
          aria-describedby={[hintId, error ? errorId : null]
            .filter(Boolean)
            .join(" ")}
          onClick={() => input.current?.click()}
        >
          <Icon name="plus" size={15} />{" "}
          {busy ? "Reading the EPUB…" : "Choose an EPUB"}
        </button>
        {/* The button opens it; it isn't reached on its own. */}
        <input
          ref={input}
          type="file"
          accept=".epub,application/epub+zip"
          hidden
          tabIndex={-1}
          onChange={choose}
        />
        <p className="visually-hidden" role="status">
          {busy ? "Reading the EPUB…" : (done ?? "")}
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
            {sorted.map((u) => {
              const book = uploadToBook(u);
              const place = progress[u.id];
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
