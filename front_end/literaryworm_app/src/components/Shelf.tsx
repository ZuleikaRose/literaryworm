import { type ReactNode, useRef } from "react";
import type { BookSummary } from "../lib/booksApi";
import type { FeedStatus } from "../lib/useBookFeed";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

interface ShelfProps {
  id: string;
  title: string;
  eyebrow?: string;
  items: BookSummary[];
  /** Pass for lists that load more from the books service; omit for fixed lists. */
  status?: FeedStatus;
  error?: string | null;
  onLoadMore?: () => void;
  onRetry?: () => void;
  /** Show 1–10 rank numbers (Top 10). */
  ranked?: boolean;
  /** Reading progress per book id (Continue Reading). */
  progress?: Record<string, number>;
  /** Links per book id that replace the book page (Continue reading resumes the book). */
  links?: Record<string, string>;
  action?: ReactNode;
  /**
   * Keep the row's loading height when it ends empty or can't load (the public home page), so the
   * sections below never jump up once the page has shown (layout shift).
   */
  keepSpace?: boolean;
}

/**
 * A Home row. Scrolls left and right only: by the arrow buttons, by swiping, or by tabbing
 * through the books (each card scrolls into view as it takes focus). Rows that come from the
 * books service end with a Load more card.
 */
export function Shelf({ id, title, eyebrow, items, status, error, onLoadMore, onRetry, ranked, progress, links, action, keepSpace = false }: ShelfProps) {
  const track = useRef<HTMLUListElement>(null);
  const headingId = `${id}-title`;

  const scrollBy = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const t = useT();
  const firstLoad = status === "loading" && items.length === 0;
  const holdSpace = keepSpace && items.length === 0 && (status === "end" || status === "error");
  if (status === "end" && items.length === 0 && !holdSpace) return null;

  return (
    <section className="shelf" aria-labelledby={headingId}>
      <div className="section-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={headingId}>{title}</h2>
        </div>
        <div className="shelf-controls">
          {action}
          <button type="button" className="icon-button shelf-arrow" onClick={() => scrollBy(-1)}>
            <Icon name="chevronLeft" size={18} />
            <span className="visually-hidden">{t("Scroll {title} left", { title })}</span>
          </button>
          <button type="button" className="icon-button shelf-arrow" onClick={() => scrollBy(1)}>
            <Icon name="chevronRight" size={18} />
            <span className="visually-hidden">{t("Scroll {title} right", { title })}</span>
          </button>
        </div>
      </div>

      {holdSpace ? (
        <div className="shelf-hold">
          {/* Invisible placeholders hold the row's height; the message sits over them. */}
          <ul className="shelf-track" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={`h${i}`}>
                <BookTileSkeleton />
              </li>
            ))}
          </ul>
          {status === "error" ? (
            <div className="feed-error shelf-hold-message" role="alert">
              <Icon name="alert" size={24} />
              <div>
                <h3>{t("We couldn't load {title}", { title })}</h3>
                <p>{error}</p>
              </div>
              <button type="button" className="secondary-button" onClick={onRetry}>
                {t("Try again")}
              </button>
            </div>
          ) : (
            <p className="shelf-hold-message shelf-hold-empty">{t("No books to show here right now.")}</p>
          )}
        </div>
      ) : status === "error" && items.length === 0 ? (
        <div className="feed-error" role="alert">
          <Icon name="alert" size={24} />
          <div>
            <h3>{t("We couldn't load {title}", { title })}</h3>
            <p>{error}</p>
          </div>
          <button type="button" className="secondary-button" onClick={onRetry}>
            {t("Try again")}
          </button>
        </div>
      ) : (
        <ul className={ranked ? "shelf-track ranked" : "shelf-track"} ref={track} role="list" aria-busy={status === "loading"}>
          {firstLoad &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={`s${i}`}>
                <BookTileSkeleton />
              </li>
            ))}
          {items.map((book, i) => (
            <li key={book.id}>
              {ranked && (
                <span className="rank" aria-hidden="true">
                  {i + 1}
                </span>
              )}
              {ranked && <span className="visually-hidden">{t("Number {n}: ", { n: i + 1 })}</span>}
              <BookTile book={book} priority={i < 6} progress={progress?.[book.id]} to={links?.[book.id]} />
            </li>
          ))}
          {status === "idle" && onLoadMore && (
            <li className="shelf-more">
              <button type="button" onClick={onLoadMore}>
                <Icon name="plus" size={22} />
                {t("Load more")}
                <span className="visually-hidden">{t(" in {title}", { title })}</span>
              </button>
            </li>
          )}
          {status === "loading" && items.length > 0 && (
            <li className="shelf-more">
              <BookTileSkeleton />
            </li>
          )}
          {status === "error" && items.length > 0 && (
            <li className="shelf-more">
              <button type="button" onClick={onRetry}>
                <Icon name="alert" size={22} />
                {t("Couldn't load more. Try again")}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
