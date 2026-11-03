import { useId, useState } from "react";
import { books as catalog, getBook } from "../data/books";
import { addGiftBooks, GIFT_BOOKS_MAX } from "../lib/gifts";
import { wordsMatch } from "../lib/search";
import { useT } from "../lib/useT";
import { useProfileData } from "../store/context";
import { Icon } from "./Icon";

/**
 * *Books to go with it* on Gifts: up to GIFT_BOOKS_MAX LiteraryWorm titles that come with the
 * gift and go into the recipient's library when they redeem it. Find a title, or add the
 * LiteraryWorm books from one of your lists; chosen books show as a list with *Remove*.
 */
export function GiftBooksPicker({ books, onChange }: { books: string[]; onChange: (books: string[]) => void }) {
  const t = useT();
  const id = useId();
  const { customLists } = useProfileData();
  const [query, setQuery] = useState("");
  const [listId, setListId] = useState("");
  const [note, setNote] = useState("");
  const q = query.trim();
  const matches = q.length >= 2 ? catalog.filter((b) => wordsMatch(b.title, q) && !books.includes(b.id)).slice(0, 6) : [];
  // Only lists with LiteraryWorm titles in them: Google Books titles can't come with a gift.
  const lists = customLists.filter((l) => l.bookIds.some((b) => getBook(b)));
  const chosenList = lists.find((l) => l.id === listId) ?? lists[0];

  function add(ids: string[], what: string) {
    const { books: next, leftOut } = addGiftBooks(books, ids);
    onChange(next);
    const added = next.length - books.length;
    setNote(
      leftOut > 0
        ? t.plural(added, { one: "Added {count} book. A gift can come with up to {max}, so {left} didn't fit.", other: "Added {count} books. A gift can come with up to {max}, so {left} didn't fit." }, { max: GIFT_BOOKS_MAX, left: leftOut })
        : added === 0
          ? ids.length === 1
            ? t("{what} is already on the gift.", { what })
            : t("{what} are already on the gift.", { what })
          : t("Added {what}.", { what }),
    );
  }

  return (
    <fieldset className="gift-books">
      <legend>{t("Books to go with it (optional)")}</legend>
      <p className="field-hint">
        {t("Up to {max} LiteraryWorm books. They're waiting in their library when they redeem the gift, and named in the email if we send it.", { max: GIFT_BOOKS_MAX })}
      </p>

      {books.length > 0 && (
        <ul className="gift-books-chosen" role="list" aria-label={t("Books on the gift")}>
          {books.map((b) => {
            const book = getBook(b);
            return (
              <li key={b}>
                <span>
                  <strong>{book?.title ?? b}</strong>
                  {book && <span className="muted">{t(" by {author}", { author: book.author })}</span>}
                </span>
                <button type="button" className="text-button" onClick={() => (onChange(books.filter((x) => x !== b)), setNote(t("Removed {title}.", { title: book?.title ?? t("the book") })))}>
                  {t("Remove")}<span className="visually-hidden"> {book?.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {books.length < GIFT_BOOKS_MAX && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-find`}>
            {t("Find a book")}
          </label>
          <input id={`${id}-find`} className="field-input" type="search" value={query} autoComplete="off" aria-describedby={`${id}-find-hint`} onChange={(e) => setQuery(e.target.value)} />
          <p className="field-hint" id={`${id}-find-hint`}>
            {t("Type part of a title, then choose Add.")}
          </p>
          {matches.length > 0 && (
            <ul className="gift-books-matches" role="list" aria-label={t("Matching books")}>
              {matches.map((b) => (
                <li key={b.id}>
                  <span>
                    {b.title} <span className="muted">{t("by {author}", { author: b.author })}</span>
                  </span>
                  <button type="button" className="secondary-button small-button" onClick={() => (add([b.id], b.title), setQuery(""))}>
                    <Icon name="plus" size={15} /> {t("Add")}<span className="visually-hidden"> {b.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && matches.length === 0 && <p className="muted">{t("No LiteraryWorm titles match “{query}”.", { query: q })}</p>}
        </div>
      )}

      {lists.length > 0 && books.length < GIFT_BOOKS_MAX && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-list`}>
            {t("Or add one of your lists")}
          </label>
          <div className="gift-books-list-row">
            <select id={`${id}-list`} className="field-input" value={chosenList?.id ?? ""} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-button"
              onClick={() => chosenList && add(chosenList.bookIds.filter((b) => getBook(b)), t("the books from {list}", { list: chosenList.name }))}
            >
              {t("Add the list")}
            </button>
          </div>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {note}
      </p>
    </fieldset>
  );
}
