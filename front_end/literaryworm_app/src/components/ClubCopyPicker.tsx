import { useState } from "react";
import { Link } from "react-router-dom";
import { type Club, copyChoices } from "../lib/clubs";
import { useClubs } from "../lib/useClubs";
import type { UploadedBook } from "../types";
import { Field } from "./Field";
import { Icon } from "./Icon";

/**
 * A club reading an uploaded book, before this member has linked their own copy. Uploads are
 * private copies, so nobody's file is shared: each member uploads the book themselves (a DRM-free
 * EPUB, perhaps bought elsewhere) and chooses it here. Copies with the club book's title and author
 * come first; the search narrows by title or author.
 */
export function ClubCopyPicker({ club, uploads, onLinked }: { club: Club; uploads: UploadedBook[]; onLinked: () => void }) {
  const clubs = useClubs();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = copyChoices(uploads, club, query);
  const book = club.bookTitle ?? "the club's book";

  const use = async (upload: UploadedBook) => {
    setBusy(upload.id);
    setError(null);
    try {
      await clubs.linkCopy(club.id, upload.id);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't use that copy. Try again.");
      setBusy(null);
    }
  };

  return (
    <div className="club-page page-content">
      <header className="club-header club-header-plain">
        <div>
        <p className="eyebrow">Book club</p>
        <h1>{club.name}</h1>
        <p>
          Reading <strong>{book}</strong>
          {club.bookAuthor && ` by ${club.bookAuthor}`}, an uploaded book.
        </p>
        </div>
      </header>
      <section className="club-copy" aria-labelledby="club-copy-title">
        <h2 id="club-copy-title">Choose your copy</h2>
        <p>
          Each member reads their own copy of an uploaded book, so the discussion follows your place in it and nothing past your chapter is spoiled. Upload{" "}
          {club.bookTitle ? <em>{club.bookTitle}</em> : "it"} (a DRM-free EPUB, such as one you bought) on this profile, then choose it below.
        </p>
        {uploads.length === 0 ? (
          <p className="goal-hint">You haven't uploaded any books on this profile yet.</p>
        ) : (
          <>
            <Field label="Find your copy" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or author" autoComplete="off" />
            {choices.length === 0 ? (
              <p className="goal-hint" role="status">
                None of your uploads match that search.
              </p>
            ) : (
              <ul className="club-copy-list" role="list">
                {choices.map((u) => (
                  <li key={u.id}>
                    <span>
                      <strong>{u.title}</strong>
                      {u.author && <small> {u.author}</small>}
                    </span>
                    <button type="button" className="secondary-button small-button" disabled={busy !== null} onClick={() => use(u)}>
                      {busy === u.id ? "Choosing…" : "Use this copy"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
        <div className="goal-actions">
          <Link className="primary-button small-button" to="/library?view=uploads">
            Upload a book
          </Link>
          <Link className="ghost-button small-button" to="/library?view=clubs">
            Your clubs
          </Link>
        </div>
      </section>
    </div>
  );
}
