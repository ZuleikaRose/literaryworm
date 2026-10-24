import { Link, useSearchParams } from "react-router-dom";
import { BookFeed } from "../components/BookFeed";
import { FeaturedCarousel } from "../components/FeaturedCarousel";
import { GenreNav } from "../components/GenreNav";
import { Icon } from "../components/Icon";
import { Shelf } from "../components/Shelf";
import { books, getBook, isAllowed } from "../data/books";
import { type BrowseGenre, browseGenres, genreLabel, isBrowseGenre } from "../data/genres";
import { fromLocal } from "../lib/booksApi";
import { useBookFeed } from "../lib/useBookFeed";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useProfileData } from "../store/context";
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
          to={genre === "technology" ? "/browse" : `/browse?genre=${genre}`}
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
  const data = useProfileData();
  const [params] = useSearchParams();
  const genreParam = params.get("genre");
  const genre: BrowseGenre = isBrowseGenre(genreParam) ? genreParam : "technology";

  const visible = (b: Book | undefined): b is Book => !!b && isAllowed(b.ageRating, profile.ageRating);
  const catalog = books.filter(visible);

  const continueReading = Object.values(data?.progress ?? {})
    .filter((p) => !p.finished)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => getBook(p.bookId))
    .filter(visible);
  const progress = Object.fromEntries(Object.values(data?.progress ?? {}).map((p) => [p.bookId, p.fraction]));

  const featured = catalog.filter((b) => b.featured);
  const trending = catalog.filter((b) => b.trendingRank).sort((a, b) => a.trendingRank! - b.trendingRank!);
  const newReleases = catalog.filter((b) => b.newRelease);
  const topTen = [...catalog].sort((a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount).slice(0, 10);

  // The catalog title most recently added to the library.
  const saved = Object.values(data?.library ?? {}).sort((a, b) => b.addedAt - a.addedAt);
  const lastSaved = saved.map((entry) => getBook(entry.bookId)).find(visible);
  const becauseSaved = lastSaved
    ? catalog.filter(
        (b) => b.id !== lastSaved.id && !data?.library[b.id] && b.genres.some((g) => lastSaved.genres.includes(g)),
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
          />
        )}
        <Shelf id="trending" eyebrow="Curated for you" title="Trending this week" items={trending.map(fromLocal)} />

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

        <Shelf id="top-ten" eyebrow="Highest rated" title="Top 10 on BookWorm" items={topTen.map(fromLocal)} ranked />
        {newReleases.length > 0 && (
          <Shelf id="new" eyebrow="Just added" title="New releases" items={newReleases.map(fromLocal)} />
        )}
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
