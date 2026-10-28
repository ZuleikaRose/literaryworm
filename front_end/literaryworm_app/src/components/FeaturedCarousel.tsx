import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listenMinutes } from "../data/books";
import type { Book } from "../types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

const ADVANCE_MS = 7000;

function prefersReducedMotion(): boolean {
  return (
    matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion")
  );
}

/**
 * Featured titles. Advances every 7 seconds with a Pause button (WCAG 2.2.2), stops while
 * the pointer or keyboard focus is inside it, and starts paused when motion is reduced.
 * Announces the new slide only when the reader changed it.
 */
export function FeaturedCarousel({ books, label = "Featured titles" }: { books: Book[]; label?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [hold, setHold] = useState(false);
  const count = books.length;
  const running = !paused && !hold && count > 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [running, count]);

  if (count === 0) return null;
  const go = (i: number) => setIndex((i + count) % count);

  return (
    <section
      className="hero featured"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHold(false)}
    >
      <div className="hero-glow" aria-hidden="true" />
      <div className="featured-slides" aria-live={running ? "off" : "polite"}>
        {books.map((book, i) => (
          <div
            key={book.id}
            className="featured-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            hidden={i !== index % count}
          >
            <div className="hero-copy">
              <p className="eyebrow">Editors' pick · {book.genres[0]}</p>
              <h2 className="featured-title">{book.title}</h2>
              <p className="featured-byline">
                {book.author} · {book.year}
                {book.formats.includes("audiobook") && ` · ${Math.round(listenMinutes(book) / 60)} hr listen`}
              </p>
              <p className="featured-synopsis">{book.synopsis}</p>
              <Link className="primary-button" to={`/books/${book.id}`}>
                See {book.title} <Icon name="chevronRight" size={18} />
              </Link>
            </div>
            <div className="featured-cover" aria-hidden="true">
              <Cover book={book} size="lg" />
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="featured-controls">
          <button type="button" className="icon-button" onClick={() => setPaused((p) => !p)}>
            <Icon name={paused ? "play" : "pause"} size={16} />
            <span className="visually-hidden">{paused ? "Play featured titles" : "Pause featured titles"}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => go(index - 1)}>
            <Icon name="chevronLeft" size={18} />
            <span className="visually-hidden">Previous featured title</span>
          </button>
          <ol className="featured-dots" role="list">
            {books.map((book, i) => (
              <li key={book.id}>
                <button type="button" aria-current={i === index % count ? "true" : undefined} onClick={() => go(i)}>
                  <span className="visually-hidden">
                    Show {book.title} ({i + 1} of {count})
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="icon-button" onClick={() => go(index + 1)}>
            <Icon name="chevronRight" size={18} />
            <span className="visually-hidden">Next featured title</span>
          </button>
        </div>
      )}
    </section>
  );
}
