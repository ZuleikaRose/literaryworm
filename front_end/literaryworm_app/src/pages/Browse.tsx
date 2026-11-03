import { SprintNudge } from "../components/SprintNudge";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookFeed } from "../components/BookFeed";
import { FeaturedCarousel } from "../components/FeaturedCarousel";
import { GenreNav } from "../components/GenreNav";
import { MostFollowed } from "../components/MostFollowed";
import { OutNow } from "../components/RemindersView";
import { ReadingPlansCard } from "../components/ReadingPlansCard";
import { Icon } from "../components/Icon";
import { Shelf } from "../components/Shelf";
import { KeywordIdeas } from "../components/KeywordIdeas";
import { WhatsNewLink } from "../components/WhatsNewLink";
import { books, getBook, isAllowed } from "../data/books";
import { type BrowseGenre, browseGenres, favouriteGenreId, genreHref, genreLabel, isBrowseGenre } from "../data/genres";
import { fromLocal } from "../lib/booksApi";
import { otherLanguageBooks } from "../lib/languages";
import { FEEL_GOOD } from "../lib/moods";
import { fromFollowed } from "../lib/people";
import { dueWords } from "../lib/words";
import { useHighlightReview } from "../lib/useHighlightReview";
import { today } from "../lib/reading";
import { approvedBooks } from "../lib/bookRequests";
import { shelfFor } from "../lib/familyShelf";
import { useFamilyShelf } from "../lib/useFamilyShelf";
import { continueSeries } from "../lib/series";
import { moreLike, recommend, type Seed, tasteSeeds } from "../lib/recommend";
import { surpriseBook } from "../lib/search";
import { useBookFeed } from "../lib/useBookFeed";
import { useLibrary } from "../lib/useLibrary";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich, type T } from "../lib/i18n";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { AgeRating, Book } from "../types";

/**
 * A genre as a Home row, loading more at its end: the brief's six, and up to two of the profile's
 * favourite genres beyond them (`favourite` adds an eyebrow). The others are in the genre links.
 */
function GenreShelf({ genre, ageRating, favourite = false }: { genre: BrowseGenre; ageRating: AgeRating; favourite?: boolean }) {
  // Technology uses the same "technology" list as the public home page.
  const feed = useBookFeed(genre === "technology" ? { mode: "home" } : { mode: "genre", genre }, ageRating);
  const t = useT();
  return (
    <Shelf
      id={`genre-${genre}`}
      eyebrow={favourite ? t("One of your favourite genres") : undefined}
      title={t(genreLabel(genre))}
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
          {t("See all")}<span className="visually-hidden"> {t(genreLabel(genre))}</span> <Icon name="chevronRight" size={16} />
        </Link>
      }
    />
  );
}

/** A "Because you…" row's title, by why the book counts. */
function becauseTitle(t: T, reason: Seed["reason"], title: string) {
  return reason === "finished"
    ? t("Because you finished {title}", { title })
    : reason === "loved"
      ? t("Because you loved {title}", { title })
      : reason === "liked"
        ? t("Because you liked {title}", { title })
        : t("Because you favourited {title}", { title });
}

export default function Browse() {
  const t = useT();
  useTitle(t("Home"));
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
  // My words due for review today (lib/words.ts).
  const wordsDue = dueWords(data.words, today()).length;
  // Highlights due for review today (lib/highlightReview.ts).
  const highlightsDue = useHighlightReview().due.length;
  // Books above a Kids profile's rating that a grown-up said yes to (lib/bookRequests.ts).
  const saidYes = profile.ageRating === "kids" ? approvedBooks(data.bookRequests) : [];
  // The family shelf, as this profile may see it (lib/familyShelf.ts).
  const family = useFamilyShelf();
  const familyBooks = shelfFor(family.items, profile, data.bookRequests, getBook);

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
  // Books this profile tagged with a cheerful mood (lib/moods.ts), to read again: the most cheerful first.
  const cheer = (id: string) => data.moods[id]?.moods.filter((m) => FEEL_GOOD.includes(m)).length ?? 0;
  const feelGood = Object.keys(data.moods)
    .filter((id) => cheer(id) > 0)
    .sort((a, b) => cheer(b) - cheer(a))
    .map((id) => getBook(id))
    .filter(visible);
  // The classics in French, German and Spanish this profile may see (lib/languages.ts).
  const otherLanguages = otherLanguageBooks(profile.ageRating);

  // Recommendations from what this profile finished, rated and favourited (lib/recommend.ts).
  const inLibrary = new Set(Object.keys(library.entries));
  const followed = fromFollowed(data.follows, profile.ageRating, (id) => inLibrary.has(id));
  // The next book in each series this profile finished a book of, newest first.
  const finishedNewestFirst = Object.entries(data.readingDays)
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([, d]) => d.books ?? [])
    .concat(Object.values(library.entries).filter((e) => e.status === "finished").sort((a, b) => b.addedAt - a.addedAt).map((e) => e.bookId));
  const seriesNext = continueSeries([...new Set(finishedNewestFirst)], profile.ageRating).filter(visible);
  const taste = tasteSeeds(data, library.entries, (id) => {
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
  // Up to two favourite genres that don't already have a row (the brief's six do).
  const favouriteShelves = [
    ...new Set(profile.favoriteGenres.map(favouriteGenreId).filter((id): id is BrowseGenre => id !== null && !browseGenres.find((g) => g.id === id)?.shelf)),
  ].slice(0, 2);
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
      <h1 className="visually-hidden">{t("Home for {name}", { name: profile.name })}</h1>
      <FeaturedCarousel books={featured} />

      <div className="page-content home-rows">
        {wordsDue > 0 && (
          <Link className="home-nudge" to="/library?view=words">
            <Icon name="clock" size={18} />
            <span>
              {rich(t("{words} from My words. A minute's practice keeps them."), {
                words: <strong>{t.plural(wordsDue, { one: "{count} word to review today", other: "{count} words to review today" })}</strong>,
              })}
            </span>
          </Link>
        )}
        {highlightsDue > 0 && (
          <Link className="home-nudge" to="/library?view=notes">
            <Icon name="highlighter" size={18} />
            <span>
              {rich(t("{highlights} in Notes. Passages you marked, back just before they fade."), {
                highlights: <strong>{t.plural(highlightsDue, { one: "{count} highlight to review today", other: "{count} highlights to review today" })}</strong>,
              })}
            </span>
          </Link>
        )}
        <SprintNudge />
        <ReadingPlansCard />
        {continueReading.length > 0 && (
          <Shelf
            id="continue"
            eyebrow={t("Pick up where you stopped")}
            title={t("Continue reading")}
            items={continueReading.map(fromLocal)}
            progress={progress}
            links={resumeLinks}
          />
        )}
        <OutNow />
        {seriesNext.length > 0 && (
          <Shelf id="series-next" eyebrow={t("What comes next")} title={t("Continue the series")} items={seriesNext.map(fromLocal)} />
        )}
        {familyBooks.length > 0 && (
          <Shelf id="family-shelf" eyebrow={t("Put out by your household")} title={t("The family shelf")} items={familyBooks.map(fromLocal)} />
        )}
        {saidYes.length > 0 && (
          <Shelf id="said-yes" eyebrow={t("You asked, a grown-up said yes")} title={t("Books you asked for")} items={saidYes.map(fromLocal)} />
        )}
        {followed.length > 0 && (
          <Shelf
            id="following"
            eyebrow={t("Authors and narrators you follow")}
            title={t("New from people you follow")}
            items={followed.map(fromLocal)}
          />
        )}
        {profile.ageRating !== "kids" && <MostFollowed />}
        <Shelf
          id="trending"
          eyebrow={t("Curated for you")}
          title={t("Trending this week")}
          items={trending.map(fromLocal)}
          action={
            <button
              type="button"
              className="secondary-button surprise-button"
              onClick={() => navigate(`/books/${surpriseBook(profile.ageRating).id}`)}
            >
              <Icon name="shuffle" size={16} /> {t("Surprise me")}
            </button>
          }
        />

        <section className="community-banner" aria-labelledby="reading-room-title">
          <span className="community-icon" aria-hidden="true">
            <Icon name="bookOpen" size={27} />
          </span>
          <div>
            <p className="eyebrow">{t("The reading room")}</p>
            <h2 id="reading-room-title">{t("What readers are talking about")}</h2>
            <p>{t("Every book page shows the logs readers have written about it, with their display name and date.")}</p>
          </div>
          {trending[0] && (
            <Link className="secondary-button" to={`/books/${trending[0].id}`}>
              {t("Read the logs on {title}", { title: trending[0].title })}
            </Link>
          )}
        </section>

        <KeywordIdeas />

        <WhatsNewLink />

        <Shelf id="top-ten" eyebrow={t("Highest rated")} title={t("Top 10 on LiteraryWorm")} items={topTen.map(fromLocal)} ranked />
        {newReleases.length > 0 && (
          <Shelf id="new" eyebrow={t("Just added")} title={t("New releases")} items={newReleases.map(fromLocal)} />
        )}
        {feelGood.length > 0 && <Shelf id="feel-good" eyebrow={t("Books you tagged funny, hopeful and more")} title={t("Feel-good picks")} items={feelGood.map(fromLocal)} />}
        {otherLanguages.length > 0 && (
          <Shelf
            id="languages"
            eyebrow={t("Classics in French, German and Spanish")}
            title={t("In their own language")}
            items={otherLanguages.map(fromLocal)}
          />
        )}
        {/* With no history yet, the "Because you saved" row below says the same thing. */}
        {picked.length >= 3 && (taste.length > 0 || becauseSaved.length === 0) && (
          <Shelf
            id="picked"
            eyebrow={t("Based on what {name} reads", { name: profile.name })}
            title={t("Picked for you")}
            items={picked.map((r) => fromLocal(r.book))}
          />
        )}
        {because.map(({ seed, items }) => (
          <Shelf
            key={seed.book.id}
            id={`because-${seed.book.id}`}
            eyebrow={t("Find something new")}
            title={becauseTitle(t, seed.reason, seed.book.title)}
            items={items.map(fromLocal)}
          />
        ))}
        {lastSaved && becauseSaved.length > 0 && (
          <Shelf
            id="because-saved"
            eyebrow={t("Find something new")}
            title={t("Because you saved {title}", { title: lastSaved.title })}
            items={becauseSaved.map(fromLocal)}
          />
        )}

        {favouriteShelves.map((id) => (
          <GenreShelf key={id} genre={id} ageRating={profile.ageRating} favourite />
        ))}

        {browseGenres.filter((g) => g.shelf).map((g) => (
          <GenreShelf key={g.id} genre={g.id} ageRating={profile.ageRating} />
        ))}

        <div id="discover">
          <BookFeed
            id="discover"
            eyebrow={t("Keep discovering")}
            title={t("{genre} books", { genre: t(genreLabel(genre)) })}
            query={genre === "technology" ? { mode: "home" } : { mode: "genre", genre }}
            ageRating={profile.ageRating}
            controls={<GenreNav current={genre} basePath="/browse" />}
          />
        </div>
      </div>
    </div>
  );
}
