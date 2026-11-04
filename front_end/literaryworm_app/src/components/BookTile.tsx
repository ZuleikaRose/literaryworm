import { useState } from "react";
import { Link } from "react-router-dom";
import type { BookSummary } from "../lib/booksApi";
import { ESSENTIAL } from "../lib/consent";
import { fallbackCover } from "../lib/coverFallback";
import { BookCard } from "./BookCard";
import { Cover } from "./Cover";
import { useT } from "../lib/useT";

interface BookTileProps {
  book: BookSummary;
  /** Eager-load covers that are on screen at first paint. */
  priority?: boolean;
  /** 0–1 reading progress (Continue Reading). */
  progress?: number;
  /** Overrides where a catalog card links (Continue reading). */
  to?: string;
}

/** A book from a list: the drawn LiteraryWorm card for catalog titles, the Google cover otherwise. */
export function BookTile({ book, priority = false, progress, to }: BookTileProps) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  if (book.local) return <BookCard book={book.local} progress={progress} to={to} />;

  const author = book.authors.length ? book.authors.join(", ") : t("Unknown author");
  const drawn = { cover: fallbackCover(book.id), genres: book.categories.slice(0, 1), title: book.title, author };

  return (
    <Link className="book-card" to={`/books/${book.id}`}>
      <span className="book-card-cover">
        {book.cover && !broken ? (
          <span className="book-cover cover-md cover-photo">
            <img
              {...ESSENTIAL}
              src={book.cover}
              alt={t("Cover of {title}", { title: book.title })}
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
