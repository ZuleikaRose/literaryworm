import { Link } from "react-router-dom";
import type { Book } from "../types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

interface BookCardProps {
  book: Book;
  /** 0–1 reading progress, shown as a bar under the cover. */
  progress?: number;
}

export function BookCard({ book, progress }: BookCardProps) {
  return (
    <Link className="book-card" to={`/book/${book.id}`}>
      <span className="book-card-cover">
        <Cover book={book} />
        {progress !== undefined && (
          <span className="card-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="book-card-copy">
        <strong>{book.title}</strong>
        <small>{book.author}</small>
        <span className="rating">
          <Icon name="star" size={13} filled /> {book.rating.toFixed(1)}
          <span className="visually-hidden"> out of 5</span>
          {progress !== undefined && <span className="card-progress-label">{Math.round(progress * 100)}% read</span>}
        </span>
      </span>
    </Link>
  );
}
