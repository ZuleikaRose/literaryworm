import type { CSSProperties } from "react";
import type { Book } from "../types";

interface CoverProps {
  book: Book;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * A drawn cover, built from the book's palette and one motif, matching the wireframe's
 * covers. It's decorative: the title and author it shows are always repeated in text nearby.
 */
export function Cover({ book, size = "md", className }: CoverProps) {
  const { motif, bg, ink, accent, bg2 } = book.cover;
  const style = {
    "--cover-bg": bg,
    "--cover-bg2": bg2 ?? bg,
    "--cover-ink": ink,
    "--cover-accent": accent,
  } as CSSProperties;
  return (
    <div className={`book-cover cover-${size}${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {/* The face sits inside the size container so its cqi units track the cover's width. */}
      <div className={`cover-face motif-${motif}`}>
        <span className="cover-kicker">{book.genres[0]}</span>
        <strong className="cover-title">{book.title}</strong>
        <small className="cover-author">{book.author}</small>
      </div>
    </div>
  );
}
