import { useEffect, useId, useState } from "react";
import { type BookCharacter, CharactersError, fetchCharacters } from "../lib/charactersApi";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { tr } from "../lib/i18n";
import { useT } from "../lib/useT";

/** Above this many, a box to find someone by name. */
const FILTER_FROM = 8;

/**
 * The reader's Who's who: the characters met so far in a public-domain title, up to the
 * chapter open now, labelled as written by AI. Nobody first met later is listed.
 */
export function CharactersDialog({ open, book, chapterIndex, onClose }: { open: boolean; book: Book; chapterIndex: number; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Who's who")} eyebrow={book.title}>
      {open && <Characters key={chapterIndex} book={book} chapterIndex={chapterIndex} />}
    </Dialog>
  );
}

function Characters({ book, chapterIndex }: { book: Book; chapterIndex: number }) {
  const t = useT();
  const [list, setList] = useState<BookCharacter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [filter, setFilter] = useState("");
  const id = useId();

  useEffect(() => {
    let live = true;
    fetchCharacters(book.id, chapterIndex).then(
      (found) => {
        if (!live) return;
        setList(found);
        setError(null);
      },
      (err) => {
        if (live) setError(err instanceof CharactersError ? err.message : tr("Something went wrong. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, chapterIndex, tries]);

  const wanted = filter.trim().toLowerCase();
  const shown = (list ?? []).filter((c) => !wanted || c.name.toLowerCase().includes(wanted));

  return (
    <div className="characters">
      <p className="goal-hint">
        <Icon name="ask" size={15} />{" "}
        {t("Written by AI from the book up to chapter {chapter}. Nobody you haven't met yet is listed, and nothing later is given away.", { chapter: chapterIndex + 1 })}
      </p>

      {error ? (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button small-button"
              onClick={() => {
                setError(null);
                setTries((n) => n + 1);
              }}
            >
              {t("Try again")}
            </button>
          </div>
        </div>
      ) : list === null ? (
        <p role="status" aria-busy="true">
          {t("Gathering who's who up to chapter {chapter}… The first time for a chapter can take a few seconds.", { chapter: chapterIndex + 1 })}
        </p>
      ) : (
        <>
          {list.length >= FILTER_FROM && (
            <div className="field">
              <label className="field-label" htmlFor={`${id}-find`}>
                {t("Find someone")}
              </label>
              <input id={`${id}-find`} className="field-input" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} autoComplete="off" />
            </div>
          )}
          <p className="visually-hidden" role="status">
            {wanted
              ? t.plural(list.length, { one: "{shown} of {count} character", other: "{shown} of {count} characters" }, { shown: shown.length })
              : t.plural(list.length, { one: "{count} character so far", other: "{count} characters so far" })}
          </p>
          {shown.length === 0 ? (
            <p className="goal-hint">{t("Nobody by that name so far.")}</p>
          ) : (
            <ul className="character-list" role="list">
              {shown.map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong>
                  <p>{c.description}</p>
                  <small>{t("First met in chapter {chapter}", { chapter: c.firstChapter })}</small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
