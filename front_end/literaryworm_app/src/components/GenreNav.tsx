import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useT } from "../lib/useT";
import { type BrowseGenre, genreHref } from "../data/genres";
import { useBrowseGenres } from "../lib/useBrowseGenres";

interface GenreNavProps {
  current: BrowseGenre;
  /** Where the links point; the genre is added as ?genre=, and #discover takes the page to the feed. */
  basePath: string;
}

/**
 * The genres as links, so each choice has its own URL (shareable, survives a refresh,
 * works with Back). Technology is the default and has no parameter.
 */
export function GenreNav({ current, basePath }: GenreNavProps) {
  const t = useT();
  const genres = useBrowseGenres();
  const list = useRef<HTMLUListElement>(null);
  // On phones the genres are one row that scrolls sideways (.genre-nav-row): bring the chosen one into
  // view inside the row, without moving the page.
  useEffect(() => {
    const ul = list.current;
    const chosen = ul?.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement;
    if (!ul || !chosen || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollLeft = chosen.offsetLeft - ul.offsetLeft - (ul.clientWidth - chosen.offsetWidth) / 2;
  }, [current]);
  return (
    <nav className="genre-nav genre-nav-row" aria-label={t("Genres")}>
      <ul ref={list} role="list">
        {genres.map((g) => (
          <li key={g.id}>
            <Link
              to={genreHref(basePath, g.id)}
              aria-current={g.id === current ? "page" : undefined}
            >
              {t(g.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
