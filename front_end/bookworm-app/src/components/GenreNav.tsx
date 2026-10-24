import { Link } from "react-router-dom";
import { type BrowseGenre, browseGenres } from "../data/genres";

interface GenreNavProps {
  current: BrowseGenre;
  /** Where the links point; the genre is added as ?genre=. */
  basePath: string;
}

/**
 * The six genres as links, so each choice has its own URL (shareable, survives a refresh,
 * works with Back). Technology is the default and has no parameter.
 */
export function GenreNav({ current, basePath }: GenreNavProps) {
  return (
    <nav className="genre-nav" aria-label="Genres">
      <ul role="list">
        {browseGenres.map((g) => (
          <li key={g.id}>
            <Link
              to={g.id === "technology" ? basePath : `${basePath}?genre=${g.id}`}
              aria-current={g.id === current ? "page" : undefined}
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
