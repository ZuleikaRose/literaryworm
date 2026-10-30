import { type ReactNode, useEffect, useRef } from "react";
import type { BookSummary, FeedQuery } from "../lib/booksApi";
import { useBookFeed } from "../lib/useBookFeed";
import type { AgeRating } from "../types";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { Icon } from "./Icon";

interface BookFeedProps {
  id: string;
  title: string;
  eyebrow?: string;
  query: FeedQuery;
  ageRating?: AgeRating;
  /** Controls shown under the heading, such as genre links. */
  controls?: ReactNode;
  /** What to suggest when the list comes back empty. */
  emptyHint?: string;
  /** The line under a list that has loaded everything. */
  endText?: string;
  /** Told the books loaded so far, each time more arrive (author search lists their authors). */
  onItems?: (items: BookSummary[]) => void;
}

/**
 * A grid that keeps loading as the reader nears the bottom (the wireframe's "Keep
 * discovering"). A Load more button does the same for keyboard users and browsers without
 * IntersectionObserver.
 */
export function BookFeed({ id, title, eyebrow, query, ageRating = "all", controls, emptyHint = "Try another genre.", endText, onItems }: BookFeedProps) {
  const { items, status, error, loadMore, retry } = useBookFeed(query, ageRating);
  const report = useRef(onItems);
  useEffect(() => {
    report.current = onItems;
  });
  useEffect(() => {
    report.current?.(items);
  }, [items]);
  const sentinel = useRef<HTMLDivElement>(null);
  const headingId = `${id}-title`;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || status !== "idle" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      rootMargin: "0px 0px 600px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, loadMore]);

  const firstLoad = status === "loading" && items.length === 0;

  return (
    <section className="book-feed" aria-labelledby={headingId} aria-busy={status === "loading"}>
      <div className="section-heading catalog-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={headingId}>{title}</h2>
        </div>
        <p className="results-count" aria-live="polite">
          {items.length > 0 && `${items.length} books loaded`}
        </p>
      </div>
      {controls}

      {firstLoad && (
        <div className="catalog-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <BookTileSkeleton key={i} />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ul className="catalog-grid" role="list">
          {items.map((book, i) => (
            <li key={book.id}>
              <BookTile book={book} priority={i < 6} />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <div className={items.length ? "feed-error inline" : "feed-error"} role="alert">
          <Icon name="alert" size={24} />
          <div>
            <h3>{items.length ? "We couldn't load more books" : "We couldn't load these books"}</h3>
            <p>{error}</p>
          </div>
          <button type="button" className="secondary-button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {status === "end" && items.length === 0 && (
        <div className="empty-results">
          <Icon name="search" size={28} />
          <h3>No books here yet</h3>
          <p>{emptyHint}</p>
        </div>
      )}

      {status === "end" && items.length > 0 && <p className="feed-end">{endText ?? `That's everything in ${title}.`}</p>}

      {status === "idle" && (
        <div className="feed-more" ref={sentinel}>
          <button type="button" className="secondary-button" onClick={loadMore}>
            Load more books
          </button>
        </div>
      )}

      {status === "loading" && items.length > 0 && (
        <div className="load-trigger" role="status">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <small>Loading more books</small>
        </div>
      )}
    </section>
  );
}
