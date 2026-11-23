import { Link, useNavigate, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { BookFeed } from "../components/BookFeed";
import { GenreNav } from "../components/GenreNav";
import { Shelf } from "../components/Shelf";
import { StructuredData } from "../components/StructuredData";
import { type BrowseGenre, genreLabel, isBrowseGenre } from "../data/genres";
import { usesBackend } from "../lib/backend";
import { fromLocal } from "../lib/booksApi";
import { genreQuery, VISITOR_SAMPLE } from "../lib/feedChain";
import { GENRE_LIST_MAX, genreBooks, genreIndexable } from "../lib/genrePages";
import { genreDescription, genrePageNode } from "../lib/publicPages";
import { useNoindex } from "../lib/useNoindex";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { useActiveProfile, useStore } from "../store/context";
import NotFound from "./NotFound";

/**
 * A genre's page (/genres/:id): the catalog's titles in it, then more from Google Books. Each is built
 * ahead with its own title, canonical and list of titles (lib/publicPages.ts); Home's genre links lead
 * here, and vercel.json sends the old `/?genre=` addresses here too.
 */
export default function Genre() {
  const id = useParams().id ?? "";
  if (!isBrowseGenre(id)) return <NotFound />;
  return <GenrePage key={id} genre={id} />;
}

function GenrePage({ genre }: { genre: BrowseGenre }) {
  const t = useT();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const ageRating = profile?.ageRating ?? "all";
  // What a visitor sees decides the title, description and structured data, as the page built ahead has them.
  const visitorTitles = genreBooks(genre, "all");
  const titles = genreBooks(genre, ageRating).slice(0, GENRE_LIST_MAX);
  const heading = t("{genre} books", { genre: t(genreLabel(genre)) });
  useTitle(heading, genreDescription(genre, visitorTitles));
  useNoindex(!genreIndexable(genre));
  // Kids profiles see only the catalog.
  const showGoogle = usesBackend && ageRating !== "kids";

  const tryDemo = () => {
    dispatch({ type: "startDemo" });
    navigate("/profiles");
  };

  return (
    <div className="page-content genre-page">
      <StructuredData id="page" data={genrePageNode(genre, visitorTitles)} />
      <BackLink />
      <header className="series-hero">
        <p className="eyebrow">{t("Genre")}</p>
        <h1>{heading}</h1>
        {titles.length > 0 && (
          <p className="person-count">
            {t.plural(titles.length, { one: "{count} title on LiteraryWorm", other: "{count} titles on LiteraryWorm" })}
          </p>
        )}
      </header>
      <GenreNav current={genre} basePath="/" />
      {titles.length > 0 && <Shelf id="genre-catalog" eyebrow={t("Read or listen now")} title={heading} items={titles.map(fromLocal)} />}
      {showGoogle && (
        <BookFeed
          id="discover"
          eyebrow={t("From Google Books")}
          title={t("Keep discovering")}
          query={genreQuery(genre)}
          ageRating={ageRating}
          sampleSize={state.account ? undefined : VISITOR_SAMPLE}
          sampleEnd={
            <div className="feed-sample-end">
              <h3>{t("Want to keep scrolling?")}</h3>
              <p>{t("Log in or join to scroll through every genre without stopping, or try the demo household first.")}</p>
              <div className="hero-actions">
                <Link className="primary-button" to="/signin">
                  {t("Log in")}
                </Link>
                <Link className="secondary-button" to="/pricing">
                  {t("See plans and join")}
                </Link>
                <button type="button" className="text-button" onClick={tryDemo}>
                  {t("Try the demo")}
                </button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
