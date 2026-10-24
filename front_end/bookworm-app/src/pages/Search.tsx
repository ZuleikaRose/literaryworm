import { type FormEvent, useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { BookFeed } from "../components/BookFeed";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { SearchFilters } from "../components/SearchFilters";
import { browseGenres, genreLabel } from "../data/genres";
import { usesBackend } from "../lib/booksApi";
import {
  catalogMatches,
  didYouMean,
  normalizeQuery,
  QUERY_MAX,
  queryError,
  readSearchParams,
  type SearchParams,
  searchUrl,
  surpriseBook,
} from "../lib/search";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useProfileData, useStore } from "../store/context";

/**
 * /search, public. Title-only search (the brief): BookWorm's own titles first, then Google
 * Books results through the `books` Edge Function, loading more as the reader scrolls. The
 * whole search lives in the URL, so it survives a refresh and works with Back.
 */
export default function Search() {
  const [urlParams] = useSearchParams();
  const search = readSearchParams(urlParams);
  const invalid = search.q ? queryError(search.q) : null;
  const searching = Boolean(search.q) && !invalid;
  useTitle(searching ? `“${search.q}”` : "Search");

  return (
    <div className="search-page page-content">
      {/* Keyed so the box shows the query from the URL after Back, a recent search or Did you mean. */}
      <SearchHeader key={search.q} search={search} serverError={invalid} />
      {searching ? <Results search={search} /> : <StartHere />}
    </div>
  );
}

function SearchHeader({ search, serverError }: { search: SearchParams; serverError: string | null }) {
  const { dispatch } = useStore();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(search.q);
  const [error, setError] = useState<string | null>(serverError);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = normalizeQuery(draft);
    const problem = queryError(q);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    if (profile) dispatch({ type: "addRecentSearch", q });
    navigate(searchUrl({ ...search, q }));
  }

  function surprise() {
    navigate(`/books/${surpriseBook(profile?.ageRating ?? "all").id}`);
  }

  return (
    <header className="search-header">
      <h1>{search.q && !serverError ? "Search results" : "Search"}</h1>
      <form className="search-form" role="search" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor={id}>
          Search by title
        </label>
        <div className="search-form-row">
          <div className="search-input-wrap">
            <Icon name="search" size={20} />
            <input
              ref={input}
              id={id}
              className="field-input search-input"
              type="search"
              value={draft}
              maxLength={QUERY_MAX + 20}
              autoComplete="off"
              placeholder="For example, The Hobbit"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
          <button type="submit" className="primary-button">
            Search
          </button>
          <button type="button" className="secondary-button" onClick={surprise}>
            <Icon name="shuffle" size={17} /> Surprise me
          </button>
        </div>
        {error ? (
          <p className="field-error" id={`${id}-error`}>
            <Icon name="alert" size={15} />
            {error}
          </p>
        ) : (
          <p className="field-hint" id={`${id}-hint`}>
            BookWorm searches book titles only, not authors or ISBNs.
          </p>
        )}
      </form>
    </header>
  );
}

/** The empty search: recent searches for the profile, and the genres to browse. */
function StartHere() {
  const { dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const recent = profile ? data.recentSearches : [];
  const genreBase = profile ? "/browse" : "/";

  return (
    <div className="search-start">
      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <div className="section-heading">
            <h2 id="recent-title">Recent searches</h2>
            <button type="button" className="text-button" onClick={() => dispatch({ type: "clearRecentSearches" })}>
              Clear all<span className="visually-hidden"> recent searches</span>
            </button>
          </div>
          <ul className="recent-list" role="list">
            {recent.map((q) => (
              <li key={q}>
                <Link to={searchUrl({ q, genre: null, sort: "relevance", source: "all" })}>
                  <Icon name="clock" size={16} /> {q}
                </Link>
                <button type="button" className="icon-button" onClick={() => dispatch({ type: "removeRecentSearch", q })}>
                  <Icon name="close" size={15} />
                  <span className="visually-hidden">Remove “{q}” from recent searches</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="browse-genres-title">
        <h2 id="browse-genres-title">Or browse a genre</h2>
        <nav className="genre-nav" aria-label="Genres">
          <ul role="list">
            {browseGenres.map((g) => (
              <li key={g.id}>
                <Link to={g.id === "technology" ? genreBase : `${genreBase}?genre=${g.id}`}>{g.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}

function Results({ search }: { search: SearchParams }) {
  const { dispatch } = useStore();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const ageRating = profile?.ageRating ?? "all";
  // Kids profiles search BookWorm's own age-rated shelf only.
  const googleAllowed = usesBackend && ageRating !== "kids";
  const source = googleAllowed ? search.source : "bookworm";

  const catalog = source === "google" ? [] : catalogMatches(search, ageRating);
  const suggestion = catalogMatches(search, ageRating).length === 0 ? didYouMean(search.q, ageRating) : null;
  const filterCount = (search.genre ? 1 : 0) + (search.sort !== "relevance" ? 1 : 0) + (search.source !== "all" ? 1 : 0);

  function update(next: SearchParams) {
    navigate(searchUrl(next), { replace: true });
  }

  const summary = [
    `“${search.q}”`,
    search.genre && genreLabel(search.genre),
    search.sort === "newest" && "newest first",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="search-layout">
      <aside className="search-sidebar" aria-labelledby="filters-title">
        <h2 id="filters-title">Filters</h2>
        <SearchFilters value={search} onChange={update} showSource={googleAllowed} />
      </aside>

      <div className="search-results">
        <div className="results-bar">
          <p className="results-summary" aria-live="polite">
            Results for {summary}
          </p>
          <button
            type="button"
            className="secondary-button filters-button"
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen(true)}
          >
            <Icon name="settings" size={17} /> Filters{filterCount > 0 && ` (${filterCount})`}
          </button>
        </div>

        {suggestion && (
          <p className="did-you-mean">
            Did you mean{" "}
            <Link
              to={searchUrl({ ...search, q: suggestion })}
              onClick={() => profile && dispatch({ type: "addRecentSearch", q: suggestion })}
            >
              {suggestion}
            </Link>
            ?
          </p>
        )}

        {source !== "google" && (
          <section className="catalog-results" aria-labelledby="catalog-results-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Read and listen here</p>
                <h2 id="catalog-results-title">From BookWorm</h2>
              </div>
              <p className="results-count">
                {catalog.length} {catalog.length === 1 ? "title" : "titles"}
              </p>
            </div>
            {catalog.length > 0 ? (
              <ul className="catalog-grid" role="list">
                {catalog.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="search-empty">
                No BookWorm titles match. Check the spelling, try fewer words or change the filters.
              </p>
            )}
          </section>
        )}

        {source !== "bookworm" && googleAllowed && (
          <BookFeed
            key={`${search.q}|${search.genre}|${search.sort}`}
            id="google-results"
            eyebrow="Save, rate and write logs"
            title="From Google Books"
            query={{ mode: "search", q: search.q, genre: search.genre, sort: search.sort }}
            ageRating={ageRating}
            emptyHint="No Google Books titles match. Check the spelling, try fewer words or another genre."
            endText="That's every Google Books match for this search."
          />
        )}

        {ageRating === "kids" && (
          <p className="search-note">
            <Icon name="lock" size={15} /> {profile?.name}'s profile searches books picked for younger readers.
          </p>
        )}
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" size="sm">
        <SearchFilters value={search} onChange={update} showSource={googleAllowed} />
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={() => setFiltersOpen(false)}>
            Show results
          </button>
          {filterCount > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => update({ q: search.q, genre: null, sort: "relevance", source: "all" })}
            >
              Clear filters
            </button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
