import { Link } from "react-router-dom";
import { useT } from "../lib/useT";
import { type BrowseGenre, browseGenres, genreHref } from "../data/genres";

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
  return (
    <nav className="genre-nav" aria-label={t("Genres")}>
      <ul role="list">
        {browseGenres.map((g) => (
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
