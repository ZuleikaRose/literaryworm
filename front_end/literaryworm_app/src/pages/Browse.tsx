import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookFeed } from "../components/BookFeed";
import { FeaturedCarousel } from "../components/FeaturedCarousel";
import { GenreNav } from "../components/GenreNav";
import { Icon } from "../components/Icon";
import { Shelf } from "../components/Shelf";
import { books, getBook, isAllowed } from "../data/books";
import { type BrowseGenre, browseGenres, genreHref, genreLabel, isBrowseGenre } from "../data/genres";
import { fromLocal } from "../lib/booksApi";
import { moreLike, recommend, seeds } from "../lib/recommend";
import { surpriseBook } from "../lib/search";
import { useBookFeed } from "../lib/useBookFeed";
import { useLibrary } from "../lib/useLibrary";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { AgeRating, Book } from "../types";

/** One of the brief's six genres as a Home row, loading more at its end. */
function GenreShelf({ genre, ageRating }: { genre: BrowseGenre; ageRating: AgeRating }) {
  // Technology uses the same "technology" list as the public home page.
  const feed = useBookFeed(genre === "technology" ? { mode: "home" } : { mode: "genre", genre }, ageRating);
  return (
    <Shelf
      id={`genre-${genre}`}
      title={genreLabel(genre)}
      items={feed.items}
      status={feed.status}
      error={feed.error}
      onLoadMore={feed.loadMore}
      onRetry={feed.retry}
      action={
        <Link
          className="view-all"
          to={genreHref("/browse", genre)}
          onClick={() => document.getElementById("discover")?.scrollIntoView({ block: "start" })}
        >
          See all<span className="visually-hidden"> {genreLabel(genre)}</span> <Icon name="chevronRight" size={16} />
        </Link>
      }
    />
  );
}

export default function Browse() {
  useTitle("Home");
  const profile = useActiveProfile()!;
  const reading = activeReading(useStore().state);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const library = useLibrary();
  const data = useProfileData();
  const genreParam = params.get("genre");
  const genre: BrowseGenre = isBrowseGenre(genreParam) ? genreParam : "technology";

  const visible = (b: Book | undefined): b is Book => !!b && isAllowed(b.ageRating, profile.ageRating);
  const catalog = books.filter(visible);

  // Most recent first; each card reopens the format used last, at the saved place.
  const started = Object.values(reading.progress)
    .filter((p) => !p.finished)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const continueReading = started.map((p) => getBook(p.bookId)).filter(visible);
  const progress = Object.fromEntries(started.map((p) => [p.bookId, p.fraction]));
  const resumeLinks = Object.fromEntries(started.map((p) => [p.bookId, `/${p.format === "audiobook" ? "listen" : "read"}/${p.bookId}`]));

  const featured = catalog.filter((b) => b.featured);
  const trending = catalog.filter((b) => b.trendingRank).sort((a, b) => a.trendingRank! - b.trendingRank!);
  const newReleases = catalog.filter((b) => b.newRelease);
  const topTen = [...catalog].sort((a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount).slice(0, 10);

  // Recommendations from what this profile finished, rated and favourited (lib/recommend.ts).
  const inLibrary = new Set(Object.keys(library.entries));
  const taste = seeds(data, library.entries, (id) => {
    const book = getBook(id);
    return visible(book) ? book : undefined;
  });
  // Up to two "Because you…" rows from the strongest likes, then "Picked for you" from
  // everything the profile did, leaving out books those rows already show.
  const shown = new Set<string>();
  const because = taste
    .filter((s) => s.weight > 0)
    .slice(0, 2)
    .map((seed) => {
      const items = moreLike(seed.book, catalog, inLibrary, 8).filter((b) => !shown.has(b.id) && !taste.some((t) => t.book.id === b.id));
      items.forEach((b) => shown.add(b.id));
      return { seed, items };
    })
    .filter((row) => row.items.length >= 3);
  const picked = recommend(catalog, taste, profile.favoriteGenres, new Set([...inLibrary, ...because.flatMap((r) => r.items.map((b) => b.id))]));

  // With nothing to go on yet: the catalog title most recently added to the library.
  const saved = Object.values(library.entries).sort((a, b) => b.addedAt - a.addedAt);
  const lastSaved = taste.length ? undefined : saved.map((entry) => getBook(entry.bookId)).find(visible);
  const becauseSaved = lastSaved
    ? catalog.filter(
        (b) => b.id !== lastSaved.id && !library.entries[b.id] && b.genres.some((g) => lastSaved.genres.includes(g)),
      )
    : [];

  return (
    <div className="home">
      <h1 className="visually-hidden">Home for {profile.name}</h1>
      <FeaturedCarousel books={featured} />

      <div className="page-content home-rows">
        {continueReading.length > 0 && (
          <Shelf
            id="continue"
            eyebrow="Pick up where you stopped"
            title="Continue reading"
            items={continueReading.map(fromLocal)}
            progress={progress}
            links={resumeLinks}
          />
        )}
        <Shelf
          id="trending"
          eyebrow="Curated for you"
          title="Trending this week"
          items={trending.map(fromLocal)}
          action={
            <button
              type="button"
              className="secondary-button surprise-button"
              onClick={() => navigate(`/books/${surpriseBook(profile.ageRating).id}`)}
            >
              <Icon name="shuffle" size={16} /> Surprise me
            </button>
          }
        />

        <section className="community-banner" aria-labelledby="reading-room-title">
          <span className="community-icon" aria-hidden="true">
            <Icon name="bookOpen" size={27} />
          </span>
          <div>
            <p className="eyebrow">The reading room</p>
            <h2 id="reading-room-title">What readers are talking about</h2>
            <p>Every book page shows the logs readers have written about it, with their display name and date.</p>
          </div>
          {trending[0] && (
            <Link className="secondary-button" to={`/books/${trending[0].id}`}>
              Read the logs on {trending[0].title}
            </Link>
          )}
        </section>

        <Shelf id="top-ten" eyebrow="Highest rated" title="Top 10 on LiteraryWorm" items={topTen.map(fromLocal)} ranked />
        {newReleases.length > 0 && (
          <Shelf id="new" eyebrow="Just added" title="New releases" items={newReleases.map(fromLocal)} />
        )}
        {/* With no history yet, the "Because you saved" row below says the same thing. */}
        {picked.length >= 3 && (taste.length > 0 || becauseSaved.length === 0) && (
          <Shelf
            id="picked"
            eyebrow={`Based on what ${profile.name} reads`}
            title="Picked for you"
            items={picked.map((r) => fromLocal(r.book))}
          />
        )}
        {because.map(({ seed, items }) => (
          <Shelf
            key={seed.book.id}
            id={`because-${seed.book.id}`}
            eyebrow="Find something new"
            title={`Because you ${seed.reason} ${seed.book.title}`}
            items={items.map(fromLocal)}
          />
        ))}
        {lastSaved && becauseSaved.length > 0 && (
          <Shelf
            id="because-saved"
            eyebrow="Find something new"
            title={`Because you saved ${lastSaved.title}`}
            items={becauseSaved.map(fromLocal)}
          />
        )}

        {browseGenres.map((g) => (
          <GenreShelf key={g.id} genre={g.id} ageRating={profile.ageRating} />
        ))}

        <div id="discover">
          <BookFeed
            id="discover"
            eyebrow="Keep discovering"
            title={`${genreLabel(genre)} books`}
            query={genre === "technology" ? { mode: "home" } : { mode: "genre", genre }}
            ageRating={profile.ageRating}
            controls={<GenreNav current={genre} basePath="/browse" />}
          />
        </div>
      </div>
    </div>
  );
}
