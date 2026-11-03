import { type ReactNode, useEffect, useRef } from "react";
import type { BookSummary, FeedQuery } from "../lib/booksApi";
import { sampleOf } from "../lib/feedChain";
import { useBookFeed } from "../lib/useBookFeed";
import type { AgeRating } from "../types";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

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
  /** Queries to run on into when this one runs out (members' Home: the other genres). */
  then?: FeedQuery[];
  /** Show only this many books, then `sampleEnd` instead of loading more (the public home's sample). */
  sampleSize?: number;
  sampleEnd?: ReactNode;
}

/**
 * A grid that keeps loading as the reader nears the bottom (the wireframe's "Keep
 * discovering"). A Load more button does the same for keyboard users and browsers without
 * IntersectionObserver.
 */
export function BookFeed({ id, title, eyebrow, query, ageRating = "all", controls, emptyHint, endText, onItems, then, sampleSize, sampleEnd }: BookFeedProps) {
  const t = useT();
  const feed = useBookFeed(query, ageRating, then);
  const { error, retry } = feed;
  // A visitor's sample stops at its size: no more pages are asked for once it's full.
  const { shown: items, capped } = sampleOf(feed.items, sampleSize);
  const status = capped ? "end" : feed.status;
  const loadMore = feed.loadMore;
  // The invitation shows once the sample is full, or the list ran out before it filled.
  const sampleDone = sampleSize !== undefined && status === "end" && items.length > 0;
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
          {items.length > 0 && t.plural(items.length, { one: "{count} book loaded", other: "{count} books loaded" })}
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
            <h3>{items.length ? t("We couldn't load more books") : t("We couldn't load these books")}</h3>
            <p>{error}</p>
          </div>
          <button type="button" className="secondary-button" onClick={retry}>
            {t("Try again")}
          </button>
        </div>
      )}

      {status === "end" && items.length === 0 && (
        <div className="empty-results">
          <Icon name="search" size={28} />
          <h3>{t("No books here yet")}</h3>
          <p>{emptyHint ?? t("Try another genre.")}</p>
        </div>
      )}

      {sampleDone && sampleEnd}

      {status === "end" && !sampleDone && items.length > 0 && <p className="feed-end">{endText ?? t("That's everything in {title}.", { title })}</p>}

      {status === "idle" && (
        <div className="feed-more" ref={sentinel}>
          <button type="button" className="secondary-button" onClick={loadMore}>
            {t("Load more books")}
          </button>
        </div>
      )}

      {status === "loading" && items.length > 0 && (
        <div className="load-trigger" role="status">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <small>{t("Loading more books")}</small>
        </div>
      )}
    </section>
  );
}
