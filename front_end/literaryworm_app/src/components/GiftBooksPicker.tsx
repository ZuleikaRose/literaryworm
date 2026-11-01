import { useId, useState } from "react";
import { books as catalog, getBook } from "../data/books";
import { addGiftBooks, GIFT_BOOKS_MAX } from "../lib/gifts";
import { wordsMatch } from "../lib/search";
import { useProfileData } from "../store/context";
import { Icon } from "./Icon";

/**
 * *Books to go with it* on Gifts: up to GIFT_BOOKS_MAX LiteraryWorm titles that come with the
 * gift and go into the recipient's library when they redeem it. Find a title, or add the
 * LiteraryWorm books from one of your lists; chosen books show as a list with *Remove*.
 */
export function GiftBooksPicker({ books, onChange }: { books: string[]; onChange: (books: string[]) => void }) {
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
        ? `Added ${added} ${added === 1 ? "book" : "books"}. A gift can come with up to ${GIFT_BOOKS_MAX}, so ${leftOut} didn't fit.`
        : added === 0
          ? `${what} ${ids.length === 1 ? "is" : "are"} already on the gift.`
          : `Added ${what}.`,
    );
  }

  return (
    <fieldset className="gift-books">
      <legend>Books to go with it (optional)</legend>
      <p className="field-hint">
        Up to {GIFT_BOOKS_MAX} LiteraryWorm books. They're waiting in their library when they redeem the gift, and named in the email if
        we send it.
      </p>

      {books.length > 0 && (
        <ul className="gift-books-chosen" role="list" aria-label="Books on the gift">
          {books.map((b) => {
            const book = getBook(b);
            return (
              <li key={b}>
                <span>
                  <strong>{book?.title ?? b}</strong>
                  {book && <span className="muted"> by {book.author}</span>}
                </span>
                <button type="button" className="text-button" onClick={() => (onChange(books.filter((x) => x !== b)), setNote(`Removed ${book?.title ?? "the book"}.`))}>
                  Remove<span className="visually-hidden"> {book?.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {books.length < GIFT_BOOKS_MAX && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-find`}>
            Find a book
          </label>
          <input id={`${id}-find`} className="field-input" type="search" value={query} autoComplete="off" aria-describedby={`${id}-find-hint`} onChange={(e) => setQuery(e.target.value)} />
          <p className="field-hint" id={`${id}-find-hint`}>
            Type part of a title, then choose Add.
          </p>
          {matches.length > 0 && (
            <ul className="gift-books-matches" role="list" aria-label="Matching books">
              {matches.map((b) => (
                <li key={b.id}>
                  <span>
                    {b.title} <span className="muted">by {b.author}</span>
                  </span>
                  <button type="button" className="secondary-button small-button" onClick={() => (add([b.id], b.title), setQuery(""))}>
                    <Icon name="plus" size={15} /> Add<span className="visually-hidden"> {b.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && matches.length === 0 && <p className="muted">No LiteraryWorm titles match “{q}”.</p>}
        </div>
      )}

      {lists.length > 0 && books.length < GIFT_BOOKS_MAX && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-list`}>
            Or add one of your lists
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
              onClick={() => chosenList && add(chosenList.bookIds.filter((b) => getBook(b)), `the books from ${chosenList.name}`)}
            >
              Add the list
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
