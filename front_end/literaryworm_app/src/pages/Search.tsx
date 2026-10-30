import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { BookFeed } from "../components/BookFeed";
import { Dialog } from "../components/Dialog";
import { FollowButton } from "../components/FollowButton";
import { Icon } from "../components/Icon";
import { SearchFilters } from "../components/SearchFilters";
import { browseGenres, genreHref, genreLabel } from "../data/genres";
import { type BookSummary, usesBackend } from "../lib/booksApi";
import { fetchFollowerCounts } from "../lib/followersApi";
import { type AuthorMatch, followerCountNow, followersShort, matchingAuthors, personInitials, personPath } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import {
  catalogMatches,
  didYouMean,
  normalizeQuery,
  QUERY_MAX,
  queryError,
  readSearchParams,
  SEARCH_LANGUAGES,
  SEARCH_LENGTHS,
  type SearchBy,
  type SearchParams,
  searchUrl,
  surpriseBook,
  unfiltered,
} from "../lib/search";
import { useCollections } from "../lib/useCollections";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile } from "../store/context";

/**
 * /search, public. Search by title (the brief), or by author when the reader chooses (`by=author`):
 * LiteraryWorm's own titles first, then Google Books results through the `books` Edge Function
 * (its author mode for an author), loading more as the reader scrolls. The whole search lives in
 * the URL, so it survives a refresh and works with Back.
 */
export default function Search() {
  const [urlParams] = useSearchParams();
  const search = readSearchParams(urlParams);
  const invalid = search.q ? queryError(search.q, search.by) : null;
  const searching = Boolean(search.q) && !invalid;
  useTitle(searching ? `“${search.q}”` : "Search");

  return (
    <div className="search-page page-content">
      {/* Keyed so the box shows the query from the URL after Back, a recent search or Did you mean. */}
      <SearchHeader key={`${search.by}|${search.q}`} search={search} serverError={invalid} />
      {searching ? <Results search={search} /> : <StartHere />}
    </div>
  );
}

function SearchHeader({ search, serverError }: { search: SearchParams; serverError: string | null }) {
  const collections = useCollections();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(search.q);
  const [by, setBy] = useState<SearchBy>(search.by);
  const [error, setError] = useState<string | null>(serverError);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = normalizeQuery(draft);
    const problem = queryError(q, by);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    if (profile) collections.addRecentSearch(q);
    // Moving to an author search drops the filters it doesn't have.
    navigate(searchUrl(by === search.by ? { ...search, q } : { ...unfiltered(q, by), source: search.source, length: search.length }));
  }

  function surprise() {
    navigate(`/books/${surpriseBook(profile?.ageRating ?? "all").id}`);
  }

  return (
    <header className="search-header">
      <h1>{search.q && !serverError ? "Search results" : "Search"}</h1>
      <form className="search-form" role="search" onSubmit={submit} noValidate>
        <fieldset className="segmented search-by">
          <legend>Search by</legend>
          <div>
            {(["title", "author"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="search-by"
                  value={value}
                  checked={by === value}
                  onChange={() => {
                    setBy(value);
                    setError(null);
                    input.current?.focus();
                  }}
                />
                <span>{value === "title" ? "Title" : "Author"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field-label" htmlFor={id}>
          {by === "author" ? "Author's name" : "Title"}
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
              placeholder={by === "author" ? "For example, Ursula K. Le Guin" : "For example, The Hobbit"}
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
            {by === "author"
              ? "Finds books by any author whose name has every word you type, such as tolkien or le guin."
              : "Searches book titles. Choose Author to search by who wrote it."}
          </p>
        )}
      </form>
    </header>
  );
}

/** The empty search: recent searches for the profile, and the genres to browse. */
function StartHere() {
  const collections = useCollections();
  const profile = useActiveProfile();
  const recent = profile ? collections.recentSearches : [];
  const genreBase = profile ? "/browse" : "/";

  return (
    <div className="search-start">
      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <div className="section-heading">
            <h2 id="recent-title">Recent searches</h2>
            <button type="button" className="text-button" onClick={collections.clearRecentSearches}>
              Clear all<span className="visually-hidden"> recent searches</span>
            </button>
          </div>
          <ul className="recent-list" role="list">
            {recent.map((q) => (
              <li key={q}>
                <Link to={searchUrl(unfiltered(q))}>
                  <Icon name="clock" size={16} /> {q}
                </Link>
                <button type="button" className="icon-button" onClick={() => collections.removeRecentSearch(q)}>
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
                <Link to={genreHref(genreBase, g.id)}>{g.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}

function Results({ search }: { search: SearchParams }) {
  const collections = useCollections();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const ageRating = profile?.ageRating ?? "all";
  // Kids profiles search LiteraryWorm's own age-rated shelf only.
  const googleAllowed = usesBackend && ageRating !== "kids";
  const source = googleAllowed ? search.source : "literaryworm";

  const catalog = source === "google" ? [] : catalogMatches(search, ageRating);
  const byAuthor = search.by === "author";
  // The Google Books results loaded so far, for this search only (an author search lists their authors).
  const feedKey = `${search.by}|${search.q}|${search.genre}|${search.sort}|${search.lang}|${search.length}`;
  const [loaded, setLoaded] = useState<{ key: string; items: BookSummary[] }>({ key: feedKey, items: [] });
  const googleItems = loaded.key === feedKey && source !== "literaryworm" && googleAllowed ? loaded.items : [];
  const authors = byAuthor ? matchingAuthors([...catalog.map((b) => [b.author]), ...googleItems.map((b) => b.authors)], search.q) : [];
  const suggestion = !byAuthor && catalogMatches(search, ageRating).length === 0 ? didYouMean(search.q, ageRating) : null;
  const filterCount =
    (search.genre ? 1 : 0) +
    (search.sort !== "relevance" ? 1 : 0) +
    (search.source !== "all" ? 1 : 0) +
    (search.lang ? 1 : 0) +
    (search.length ? 1 : 0);

  function update(next: SearchParams) {
    navigate(searchUrl(next), { replace: true });
  }

  const summary = [
    byAuthor ? `books by “${search.q}”` : `“${search.q}”`,
    search.genre && genreLabel(search.genre),
    search.lang && SEARCH_LANGUAGES.find((l) => l.code === search.lang)?.label,
    search.length && SEARCH_LENGTHS.find((l) => l.id === search.length)?.label.toLowerCase(),
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
              onClick={() => profile && collections.addRecentSearch(suggestion)}
            >
              {suggestion}
            </Link>
            ?
          </p>
        )}

        {authors.length > 0 && <AuthorResults authors={authors} canFollow={Boolean(profile)} />}

        {source !== "google" && (
          <section className="catalog-results" aria-labelledby="catalog-results-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Read and listen here</p>
                <h2 id="catalog-results-title">From LiteraryWorm</h2>
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
                No LiteraryWorm titles match. Check the spelling, try fewer words or change the filters.
              </p>
            )}
          </section>
        )}

        {source !== "literaryworm" && googleAllowed && (
          <BookFeed
            key={feedKey}
            id="google-results"
            onItems={(items) => setLoaded({ key: feedKey, items })}
            eyebrow="Save, rate and write logs"
            title="From Google Books"
            query={
              byAuthor
                ? { mode: "author", name: search.q, loose: true, length: search.length }
                : { mode: "search", q: search.q, genre: search.genre, sort: search.sort, lang: search.lang, length: search.length }
            }
            ageRating={ageRating}
            emptyHint={
              search.length
                ? "No Google Books titles match. Google doesn't list the length of every edition, so the length filter leaves those out: try any length."
                : byAuthor
                  ? "No Google Books titles by that author. Check the spelling, or try just their surname."
                  : "No Google Books titles match. Check the spelling, try fewer words or another genre."
            }
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
              onClick={() => update(unfiltered(search.q, search.by))}
            >
              Clear filters
            </button>
          )}
        </div>
      </Dialog>
    </div>
  );
}

/** An author search's authors: each one's page, how many of the results are theirs, and Follow. */
function AuthorResults({ authors, canFollow }: { authors: AuthorMatch[]; canFollow: boolean }) {
  const follows = useFollows();
  // Follower counts for the listed authors, in one call. Whether the profile followed each is taken
  // when the counts arrive, so Follow and Unfollow move the number without asking again.
  const key = authors.map((a) => a.name).join("\n");
  const followsRef = useRef(follows);
  useEffect(() => {
    followsRef.current = follows;
  }, [follows]);
  const [counts, setCounts] = useState<{ key: string; byName: Map<string, { count: number; followedAtLoad: boolean }> } | null>(null);
  useEffect(() => {
    let live = true;
    void fetchFollowerCounts("author", key.split("\n")).then((found) => {
      if (!live || !found) return;
      const byName = new Map([...found].map(([name, count]) => [name, { count, followedAtLoad: followsRef.current.isFollowing("author", name) }]));
      setCounts({ key, byName });
    });
    return () => {
      live = false;
    };
  }, [key]);
  const followersOf = (name: string) => {
    const loaded = counts?.key === key ? counts.byName.get(name) : undefined;
    return loaded ? followersShort(followerCountNow(loaded.count, loaded.followedAtLoad, follows.isFollowing("author", name))) : null;
  };

  return (
    <section className="author-results" aria-labelledby="author-results-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Follow to see their new books first</p>
          <h2 id="author-results-title">Authors</h2>
        </div>
      </div>
      <ul className="author-list" role="list">
        {authors.map((a) => (
          <li key={a.name}>
            <span className="person-mark small" aria-hidden="true">
              {personInitials(a.name)}
            </span>
            <div className="author-text">
              <Link to={personPath("author", a.name)}>{a.name}</Link>
              <span>
                {a.books} {a.books === 1 ? "book" : "books"} below
                {followersOf(a.name) && ` · ${followersOf(a.name)}`}
              </span>
            </div>
            {canFollow && <FollowButton kind="author" name={a.name} small />}
          </li>
        ))}
      </ul>
    </section>
  );
}
