import { Link } from "react-router-dom";
import { getBook, isAllowed } from "../data/books";
import { useVolume } from "../lib/useVolume";
import type { AgeRating } from "../types";
import { BookCard } from "./BookCard";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { Icon } from "./Icon";

/**
 * A saved book id (favourite, shared list) as a grid item: the catalog card, or a Google Books
 * title fetched through the books function. Titles above `ageRating` aren't shown: catalog titles
 * by their rating, Google's by its mature flag (and none at all for Kids).
 */
export function SavedBookTile({ bookId, ageRating = "all" }: { bookId: string; ageRating?: AgeRating }) {
  const book = getBook(bookId);
  const hidden = book ? !isAllowed(book.ageRating, ageRating) : ageRating === "kids";
  const { state } = useVolume(book || hidden ? null : bookId);
  if (hidden) return null;
  if (book) {
    return (
      <li>
        <BookCard book={book} />
      </li>
    );
  }
  if (state?.status === "ready") {
    if (state.volume.mature && ageRating !== "all") return null;
    return (
      <li>
        <BookTile book={state.volume} />
      </li>
    );
  }
  if (state?.status === "error") {
    return (
      <li>
        <Link className="book-card saved-unavailable" to={`/books/${bookId}`}>
          <span className="book-card-cover">
            <span className="book-cover cover-md saved-unavailable-cover" aria-hidden="true">
              <Icon name="alert" size={22} />
            </span>
          </span>
          <span className="book-card-copy">
            <strong>Book details unavailable</strong>
            <small>Open its page to try again</small>
          </span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <BookTileSkeleton />
    </li>
  );
}
