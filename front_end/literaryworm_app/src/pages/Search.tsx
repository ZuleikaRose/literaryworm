import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { HOME_CRUMB, pageData } from "../lib/seo";
import { StructuredData } from "../components/StructuredData";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { BookFeed } from "../components/BookFeed";
import { Dialog } from "../components/Dialog";
import { FollowButton } from "../components/FollowButton";
import { Icon } from "../components/Icon";
import { SearchFilters } from "../components/SearchFilters";
import { WhatsNewLink } from "../components/WhatsNewLink";
import { genreHref, genreLabel } from "../data/genres";
import { useBrowseGenres } from "../lib/useBrowseGenres";
import { type BookSummary, usesBackend } from "../lib/booksApi";
import { fetchFollowerCounts } from "../lib/followersApi";
import { otherLanguageBooks } from "../lib/languages";
import { type AuthorMatch, followerCountNow, followersShort, matchingAuthors, personInitials, personPath } from "../lib/people";
import { useFollows } from "../lib/useFollows";
import {
  catalogMatches,
  cleanIsbn,
  didYouMean,
  languageCode,
  normalizeQuery,
  QUERY_MAX,
  queryError,
  readSearchParams,
  SEARCH_LANGUAGES,
  SEARCH_LENGTHS,
  type SearchBy,
  type SearchParams,
  hasAllFilters,
  searchUrl,
  surpriseBook,
  unfiltered,
} from "../lib/search";
import { useCollections } from "../lib/useCollections";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile } from "../store/context";
import { MOODS } from "../lib/moods";
import { KeywordIdeas } from "../components/KeywordIdeas";
import { rich, tk } from "../lib/i18n";
import { useT } from "../lib/useT";

/**
 * /search, public. Search by title (the brief), or by author, keywords or ISBN when the reader
 * chooses (`by=author`, `by=keywords`, `by=isbn`): LiteraryWorm's own titles first, then Google Books
 * results through the `books` Edge Function (its author, keywords or isbn mode), loading more as the reader scrolls. The catalog
 * keeps no ISBNs, so an ISBN search is Google Books only, and isn't offered without it. The whole search lives in
 * the URL, so it survives a refresh and works with Back.
 */
export default function Search() {
  const [urlParams] = useSearchParams();
  const search = readSearchParams(urlParams);
  const invalid = search.q ? queryError(search.q, search.by) : null;
  const searching = Boolean(search.q) && !invalid;
  const t = useT();
  useTitle(searching ? `“${search.q}”` : t("Search"));

  return (
    <div className="search-page page-content">
      {/* Keyed so the box shows the query from the URL after Back, a recent search or Did you mean. */}
      <SearchHeader key={`${search.by}|${search.q}`} search={search} serverError={invalid} />
      <StructuredData
        id="page"
        data={pageData({
          type: searching ? "SearchResultsPage" : "WebPage",
          path: searching ? searchUrl(search) : "/search",
          name: searching ? `Search results for “${search.q}”` : "Search",
          crumbs: [HOME_CRUMB, { name: "Search", path: "/search" }],
        })}
      />
      {searching ? <Results search={search} /> : <StartHere />}
      <WhatsNewLink />
    </div>
  );
}

const SEARCH_BY_LABELS: Record<SearchBy, string> = { title: tk("Title"), author: tk("Author"), keywords: tk("Keywords"), isbn: tk("ISBN") };

function SearchHeader({ search, serverError }: { search: SearchParams; serverError: string | null }) {
  const collections = useCollections();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(search.q);
  const [by, setBy] = useState<SearchBy>(search.by);
  const [error, setError] = useState<string | null>(serverError);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const t = useT();
  // Only Google Books knows ISBNs, and Kids profiles search LiteraryWorm's own shelf only.
  const isbnAllowed = usesBackend && profile?.ageRating !== "kids";
  const choices: SearchBy[] = isbnAllowed || by === "isbn" ? ["title", "author", "keywords", "isbn"] : ["title", "author", "keywords"];

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = normalizeQuery(draft);
    const problem = queryError(q, by);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    if (by === "isbn") {
      // Recent searches are titles, so an ISBN isn't kept among them.
      navigate(searchUrl(unfiltered(cleanIsbn(q)!, "isbn")));
      return;
    }
    if (profile) collections.addRecentSearch(q);
    // Moving to an author search drops the filters it doesn't have; title and keywords share theirs.
    const source = search.by === "isbn" ? "all" : search.source;
    const sameFilters = by === search.by || (hasAllFilters(by) && hasAllFilters(search.by));
    navigate(searchUrl(sameFilters ? { ...search, q, by } : { ...unfiltered(q, by), source, length: search.length }));
  }

  function surprise() {
    navigate(`/books/${surpriseBook(profile?.ageRating ?? "all").id}`);
  }

  return (
    <header className="search-header">
      <h1>{search.q && !serverError ? t("Search results") : t("Search")}</h1>
      <form className="search-form" role="search" onSubmit={submit} noValidate>
        <fieldset className="segmented search-by">
          <legend>{t("Search by")}</legend>
          <div>
            {choices.map((value) => (
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
                <span>{t(SEARCH_BY_LABELS[value])}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field-label" htmlFor={id}>
          {by === "author" ? t("Author's name") : by === "isbn" ? t("ISBN") : by === "keywords" ? t("Keywords") : t("Title")}
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
              placeholder={
                by === "author"
                  ? t("For example, {example}", { example: "Ursula K. Le Guin" })
                  : by === "isbn"
                    ? t("For example, {example}", { example: "978-0-14-143951-8" })
                    : by === "keywords"
                      ? t("For example, {example}", { example: "time travel romance" })
                      : t("For example, {example}", { example: "The Hobbit" })
              }
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
          <button type="submit" className="primary-button">
            {t("Search")}
          </button>
          <button type="button" className="secondary-button" onClick={surprise}>
            <Icon name="shuffle" size={17} /> {t("Surprise me")}
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
              ? t("Finds books by any author whose name has every word you type, such as tolkien or le guin.")
              : by === "isbn"
                ? t("The 10- or 13-digit number on the back of the book or its copyright page. Searches Google Books.")
                : by === "keywords"
                  ? t("Finds books with every word you type anywhere: the title, author, narrator, description, genres or series.")
                  : isbnAllowed
                    ? t("Searches book titles. Choose Author to search by who wrote it, Keywords to search descriptions too, or ISBN for one edition.")
                    : t("Searches book titles. Choose Author to search by who wrote it, Keywords to search descriptions too.")}
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
  const genres = useBrowseGenres();
  const otherLanguages = otherLanguageBooks(profile?.ageRating ?? "all");
  // The moods this profile has tagged books with (lib/moods.ts), each a link to those books in My Library.
  const t = useT();
  const tagged = profile ? MOODS.filter((m) => Object.values(collections.moods).some((x) => x.moods.includes(m.value))) : [];

  return (
    <div className="search-start">
      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <div className="section-heading">
            <h2 id="recent-title">{t("Recent searches")}</h2>
            <button type="button" className="text-button" onClick={collections.clearRecentSearches}>
              {t("Clear all")}<span className="visually-hidden">{t(" recent searches")}</span>
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
                  <span className="visually-hidden">{t("Remove “{q}” from recent searches", { q })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="browse-genres-title">
        <h2 id="browse-genres-title">{t("Or browse a genre")}</h2>
        <nav className="genre-nav" aria-label={t("Genres")}>
          <ul role="list">
            {genres.map((g) => (
              <li key={g.id}>
                <Link to={genreHref(genreBase, g.id)}>{t(g.label)}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      {otherLanguages.length > 0 && (
        <section aria-labelledby="languages-title">
          <h2 id="languages-title">{t("Or read a classic in its own language")}</h2>
          <nav className="genre-nav" aria-label={t("Classics in other languages")}>
            <ul role="list">
              {otherLanguages.map((b) => (
                <li key={b.id}>
                  <Link to={`/books/${b.id}`}>
                    <span lang={languageCode(b.language)}>{b.title}</span> ({t(b.language)})
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {profile?.ageRating !== "kids" && (
            <p className="field-hint">{t("In any classic, select a passage and choose Translate to read it in English or another language.")}</p>
          )}
          <p className="field-hint">{t("To use LiteraryWorm itself in Spanish, French, German, Portuguese, Italian or Dutch, choose Language in the accessibility menu at the top of the page.")}</p>
        </section>
      )}
      <KeywordIdeas />
      {tagged.length > 0 && (
        <section aria-labelledby="moods-title">
          <h2 id="moods-title">{t("Or find a book by how it felt")}</h2>
          <nav className="genre-nav" aria-label={t("Your moods")}>
            <ul role="list">
              {tagged.map((m) => (
                <li key={m.value}>
                  <Link to={`/library?mood=${m.value}`}>{t(m.label)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}
    </div>
  );
}

function Results({ search }: { search: SearchParams }) {
  const collections = useCollections();
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const t = useT();
  const ageRating = profile?.ageRating ?? "all";
  // Kids profiles search LiteraryWorm's own age-rated shelf only.
  const googleAllowed = usesBackend && ageRating !== "kids";
  const source = googleAllowed ? search.source : "literaryworm";

  const catalog = source === "google" ? [] : catalogMatches(search, ageRating);
  const byAuthor = search.by === "author";
  const byIsbn = search.by === "isbn";
  const byKeywords = search.by === "keywords";
  // The Google Books results loaded so far, for this search only (an author search lists their authors).
  const feedKey = `${search.by}|${search.q}|${search.genre}|${search.sort}|${search.lang}|${search.length}`;
  const [loaded, setLoaded] = useState<{ key: string; items: BookSummary[] }>({ key: feedKey, items: [] });
  const googleItems = loaded.key === feedKey && source !== "literaryworm" && googleAllowed ? loaded.items : [];
  const authors = byAuthor ? matchingAuthors([...catalog.map((b) => [b.author]), ...googleItems.map((b) => b.authors)], search.q) : [];
  const suggestion = search.by === "title" && catalogMatches(search, ageRating).length === 0 ? didYouMean(search.q, ageRating) : null;
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
    byAuthor
      ? t("books by “{q}”", { q: search.q })
      : byIsbn
        ? t("ISBN {q}", { q: search.q })
        : byKeywords
          ? t("the keywords “{q}”", { q: search.q })
          : `“${search.q}”`,
    search.genre && t(genreLabel(search.genre)),
    search.lang && t(SEARCH_LANGUAGES.find((l) => l.code === search.lang)?.label ?? ""),
    search.length && t(SEARCH_LENGTHS.find((l) => l.id === search.length)?.label ?? "").toLowerCase(),
    search.sort === "newest" && t("newest first"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={byIsbn ? "search-layout search-layout-single" : "search-layout"}>
      {/* An ISBN search has nothing to filter. */}
      {!byIsbn && (
        <aside className="search-sidebar" aria-labelledby="filters-title">
          <h2 id="filters-title">{t("Filters")}</h2>
          <SearchFilters value={search} onChange={update} showSource={googleAllowed} />
        </aside>
      )}

      <div className="search-results">
        <div className="results-bar">
          <p className="results-summary" aria-live="polite">
            {t("Results for {summary}", { summary })}
          </p>
          {!byIsbn && (
            <button
              type="button"
              className="secondary-button filters-button"
              aria-haspopup="dialog"
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="settings" size={17} /> {t("Filters")}{filterCount > 0 && ` (${filterCount})`}
            </button>
          )}
        </div>

        {byIsbn && !googleAllowed && (
          <p className="search-empty">
            {ageRating === "kids"
              ? t("{name}'s profile searches LiteraryWorm's own shelf, which can't be searched by ISBN. Search by title instead.", { name: profile?.name ?? "" })
              : t("Searching by ISBN needs Google Books, which this copy of the app doesn't use. Search by title instead.")}
          </p>
        )}

        {suggestion && (
          <p className="did-you-mean">
            {rich(t("Did you mean {suggestion}?"), {
              suggestion: (
                <Link to={searchUrl({ ...search, q: suggestion })} onClick={() => profile && collections.addRecentSearch(suggestion)}>
                  {suggestion}
                </Link>
              ),
            })}
          </p>
        )}

        {authors.length > 0 && <AuthorResults authors={authors} canFollow={Boolean(profile)} />}

        {source !== "google" && !byIsbn && (
          <section className="catalog-results" aria-labelledby="catalog-results-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("Read and listen here")}</p>
                <h2 id="catalog-results-title">{t("From LiteraryWorm")}</h2>
              </div>
              <p className="results-count">
                {t.plural(catalog.length, { one: "{count} title", other: "{count} titles" })}
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
                {t("No LiteraryWorm titles match. Check the spelling, try fewer words or change the filters.")}
              </p>
            )}
          </section>
        )}

        {source !== "literaryworm" && googleAllowed && (
          <BookFeed
            key={feedKey}
            id="google-results"
            onItems={(items) => setLoaded({ key: feedKey, items })}
            eyebrow={t("Save, rate and write logs")}
            title={t("From Google Books")}
            query={
              byIsbn
                ? { mode: "isbn", isbn: search.q }
                : byAuthor
                  ? { mode: "author", name: search.q, loose: true, length: search.length }
                  : { mode: "search", q: search.q, keywords: byKeywords, genre: search.genre, sort: search.sort, lang: search.lang, length: search.length }
            }
            ageRating={ageRating}
            emptyHint={
              byIsbn
                ? t("Google Books has no edition with that ISBN. Check it against the book, or search by title.")
                : search.length
                  ? t("No Google Books titles match. Google doesn't list the length of every edition, so the length filter leaves those out: try any length.")
                  : byAuthor
                    ? t("No Google Books titles by that author. Check the spelling, or try just their surname.")
                    : t("No Google Books titles match. Check the spelling, try fewer words or another genre.")
            }
            endText={t("That's every Google Books match for this search.")}
          />
        )}

        {ageRating === "kids" && (
          <p className="search-note">
            <Icon name="lock" size={15} /> {t("{name}'s profile searches books picked for younger readers.", { name: profile?.name ?? "" })}
          </p>
        )}
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t("Filters")} size="sm">
        <SearchFilters value={search} onChange={update} showSource={googleAllowed} />
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={() => setFiltersOpen(false)}>
            {t("Show results")}
          </button>
          {filterCount > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => update(unfiltered(search.q, search.by))}
            >
              {t("Clear filters")}
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
  const t = useT();
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
          <p className="eyebrow">{t("Follow to see their new books first")}</p>
          <h2 id="author-results-title">{t("Authors")}</h2>
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
                {t.plural(a.books, { one: "{count} book below", other: "{count} books below" })}
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
