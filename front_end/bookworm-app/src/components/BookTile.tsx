import { useState } from "react";
import { Link } from "react-router-dom";
import type { BookSummary } from "../lib/booksApi";
import { fallbackCover } from "../lib/coverFallback";
import { BookCard } from "./BookCard";
import { Cover } from "./Cover";

interface BookTileProps {
  book: BookSummary;
  /** Eager-load covers that are on screen at first paint. */
  priority?: boolean;
  /** 0–1 reading progress (Continue Reading). */
  progress?: number;
  /** Overrides where a catalog card links (Continue reading). */
  to?: string;
}

/** A book from a list: the drawn BookWorm card for catalog titles, the Google cover otherwise. */
export function BookTile({ book, priority = false, progress, to }: BookTileProps) {
  const [broken, setBroken] = useState(false);
  if (book.local) return <BookCard book={book.local} progress={progress} to={to} />;

  const author = book.authors.length ? book.authors.join(", ") : "Unknown author";
  const drawn = { cover: fallbackCover(book.id), genres: book.categories.slice(0, 1), title: book.title, author };

  return (
    <Link className="book-card" to={`/books/${book.id}`}>
      <span className="book-card-cover">
        {book.cover && !broken ? (
          <span className="book-cover cover-md cover-photo">
            {/* Decorative: the title and author are repeated as text below. */}
            <img
              src={book.cover}
              alt=""
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          </span>
        ) : (
          <Cover book={drawn} />
        )}
      </span>
      <span className="book-card-copy">
        <strong>{book.title}</strong>
        <small>{author}</small>
        {book.publishedYear && <span className="tile-meta">{book.publishedYear}</span>}
      </span>
    </Link>
  );
}

/** Placeholder card while a page is loading. */
export function BookTileSkeleton() {
  return (
    <span className="book-card skeleton" aria-hidden="true">
      <span className="book-cover cover-md skeleton-block" />
      <span className="skeleton-line" />
      <span className="skeleton-line short" />
    </span>
  );
}
