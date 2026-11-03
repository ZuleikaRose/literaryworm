import { Link } from "react-router-dom";
import { useT } from "../lib/useT";
import { KEYWORD_IDEAS, searchUrl, unfiltered } from "../lib/search";

/**
 * A few keyword searches to try (Discover and Search's start): each opens Search by keywords,
 * which looks through titles, authors, descriptions, genres and series.
 */
export function KeywordIdeas({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useT();
  return (
    <section className="keyword-ideas" aria-labelledby="keyword-ideas-title">
      <Heading id="keyword-ideas-title">{t("Search by keywords")}</Heading>
      <p className="field-hint">{t("Keywords look through descriptions, genres and series as well as titles and authors.")}</p>
      <nav className="genre-nav" aria-label={t("Keyword searches")}>
        <ul role="list">
          {KEYWORD_IDEAS.map((word) => (
            <li key={word}>
              <Link to={searchUrl(unfiltered(word, "keywords"))}>{word[0].toUpperCase() + word.slice(1)}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
