import { useState } from "react";
import { Link } from "react-router-dom";
import { isbnMatches, uploadChoice } from "../lib/clubBookChoices";
import { type Club, copyChoices } from "../lib/clubs";
import { useClubs } from "../lib/useClubs";
import { isbnNoteFor, useIsbnLookup } from "../lib/useIsbnLookup";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import type { UploadedBook } from "../types";
import { Field } from "./Field";
import { Icon } from "./Icon";
import { UploadFormats } from "./UploadFormats";

/**
 * A club reading an uploaded book, before this member has linked their own copy. Uploads are
 * private copies, so nobody's file is shared: each member uploads the book themselves (a DRM-free
 * EPUB, perhaps bought elsewhere) and chooses it here. Copies with the club book's title and author
 * come first; the search narrows by title or author.
 */
export function ClubCopyPicker({ club, uploads, onLinked }: { club: Club; uploads: UploadedBook[]; onLinked: () => void }) {
  const t = useT();
  const clubs = useClubs();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A title, author or ISBN: an ISBN is looked up on Google Books and matched by title and author.
  const lookup = useIsbnLookup(query);
  const ranked = copyChoices(uploads, club, lookup.isbn ? "" : query);
  const choices = lookup.isbn
    ? lookup.editions
      ? ranked.filter((u) => isbnMatches([uploadChoice(u)], lookup.editions!).length > 0)
      : []
    : ranked;
  const isbnNote = isbnNoteFor(lookup, choices.length, "uploads");
  const book = club.bookTitle ?? t("the club's book");

  const use = async (upload: UploadedBook) => {
    setBusy(upload.id);
    setError(null);
    try {
      await clubs.linkCopy(club.id, upload.id);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't use that copy. Try again."));
      setBusy(null);
    }
  };

  return (
    <div className="club-page page-content">
      <header className="club-header club-header-plain">
        <div>
        <p className="eyebrow">{t("Book club")}</p>
        <h1>{club.name}</h1>
        <p>
          {club.bookAuthor
            ? rich(t("Reading {title} by {author}, an uploaded book."), { title: <strong>{book}</strong>, author: club.bookAuthor })
            : rich(t("Reading {title}, an uploaded book."), { title: <strong>{book}</strong> })}
        </p>
        </div>
      </header>
      <section className="club-copy" aria-labelledby="club-copy-title">
        <h2 id="club-copy-title">{t("Choose your copy")}</h2>
        <p>
          {club.bookTitle
            ? rich(
                t("Each member reads their own copy of an uploaded book, so the discussion follows your place in it and nothing past your chapter is spoiled. Upload {title} (a DRM-free book file, such as one you bought) on this profile, then choose it below."),
                { title: <em>{club.bookTitle}</em> },
              )
            : t("Each member reads their own copy of an uploaded book, so the discussion follows your place in it and nothing past your chapter is spoiled. Upload it (a DRM-free book file, such as one you bought) on this profile, then choose it below.")}
        </p>
        {uploads.length === 0 ? (
          <>
            <p className="goal-hint">{t("You haven't uploaded any books on this profile yet.")}</p>
            <UploadFormats />
          </>
        ) : (
          <>
            <Field
              label={t("Find your copy")}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Title, Author or ISBN")}
              hint={isbnNote ?? undefined}
              autoComplete="off"
            />
            <p className="visually-hidden" role="status">
              {isbnNote ?? ""}
            </p>
            {choices.length === 0 ? (
              <p className="goal-hint" role="status">
                {lookup.isbn && !lookup.done ? t("Looking up that ISBN…") : t("None of your uploads match that search.")}
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
                      {busy === u.id ? t("Choosing…") : t("Use this copy")}
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
            {t("Upload a book")}
          </Link>
          <Link className="ghost-button small-button" to="/library?view=clubs">
            {t("Your clubs")}
          </Link>
        </div>
      </section>
    </div>
  );
}
