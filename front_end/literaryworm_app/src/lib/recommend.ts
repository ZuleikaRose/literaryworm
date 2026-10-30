import { inFavouriteGenre } from "../data/genres";
import type { Book, LibraryEntry, ProfileData, RatingValue } from "../types";

/**
 * Recommendations for one profile, worked out in the browser from what the profile already
 * did: books finished, loved, liked and favourited pull similar books up; "not for me" pushes
 * them down; the profile's favourite genres break ties. Only catalog titles the profile may
 * see are suggested (callers pass that list, so Kids profiles stay in their catalog), and
 * never a book already in the library. Nothing leaves the device.
 */

/** How much each thing a reader did says about their taste. */
const WEIGHTS = { finished: 1.4, love: 2, like: 1, favorite: 1.5, notForMe: -1.6 } as const;

export interface Seed {
  book: Book;
  weight: number;
  /** Why it counts, for the shelf's title: "finished", "loved". */
  reason: "finished" | "loved" | "liked" | "favourited";
}

export interface Recommendation {
  book: Book;
  score: number;
  /** The seed that pulled this book up most. */
  because: Book | null;
}

/** How alike two books are: shared genres, the same author, the same series. 0 when nothing is shared. */
export function similarity(a: Book, b: Book): number {
  const shared = a.genres.filter((g) => b.genres.includes(g)).length;
  const genres = shared / Math.max(1, new Set([...a.genres, ...b.genres]).size);
  const author = a.author === b.author ? 0.8 : 0;
  const series = a.series && b.series && a.series.name === b.series.name ? 1 : 0;
  return genres + author + series;
}

/** What the profile's history says it likes (and doesn't), strongest first. */
export function tasteSeeds(data: Pick<ProfileData, "readingDays" | "ratings" | "favorites">, library: Record<string, LibraryEntry>, find: (id: string) => Book | undefined): Seed[] {
  const byId = new Map<string, Seed & { strongest: number }>();
  const add = (id: string, weight: number, reason: Seed["reason"]) => {
    const book = find(id);
    if (!book) return;
    const had = byId.get(id);
    if (!had) {
      byId.set(id, { book, weight, reason, strongest: weight });
      return;
    }
    // Signals add up (finished and loved is stronger than either); the strongest one names it.
    had.weight += weight;
    if (weight > had.strongest) {
      had.strongest = weight;
      had.reason = reason;
    }
  };
  const finished = new Set([
    ...Object.values(data.readingDays).flatMap((d) => d.books ?? []),
    ...Object.values(library)
      .filter((e) => e.status === "finished")
      .map((e) => e.bookId),
  ]);
  for (const id of finished) add(id, WEIGHTS.finished, "finished");
  for (const [id, rating] of Object.entries(data.ratings) as [string, RatingValue][]) {
    if (rating === "love") add(id, WEIGHTS.love, "loved");
    else if (rating === "like") add(id, WEIGHTS.like, "liked");
    // Never names a shelf: only books with a positive weight do.
    else add(id, WEIGHTS.notForMe, "liked");
  }
  for (const id of data.favorites) add(id, WEIGHTS.favorite, "favourited");
  return [...byId.values()].map(({ book, weight, reason }) => ({ book, weight, reason })).sort((a, b) => b.weight - a.weight);
}

/** Scores every candidate against the seeds, best first. Books with nothing to go on are left out. */
export function recommend(candidates: Book[], seedList: Seed[], favouriteGenres: string[], exclude: Set<string>, limit = 12): Recommendation[] {
  const liked = seedList.filter((s) => s.weight > 0);
  const results: Recommendation[] = [];
  for (const book of candidates) {
    if (exclude.has(book.id) || seedList.some((s) => s.book.id === book.id)) continue;
    let score = 0;
    let because: Book | null = null;
    let best = 0;
    for (const seed of seedList) {
      const pull = seed.weight * similarity(seed.book, book);
      score += pull;
      if (seed.weight > 0 && pull > best) {
        best = pull;
        because = seed.book;
      }
    }
    const genreMatches = favouriteGenres.filter((f) => inFavouriteGenre(book.genres, f)).length;
    score += genreMatches * 0.5;
    if (score <= 0) continue;
    // A small nudge for well-rated books, so ties go to the better book.
    score += (book.rating - 3) * 0.05;
    results.push({ book, score, because: liked.length ? because : null });
  }
  return results.sort((a, b) => b.score - a.score || b.book.rating - a.book.rating).slice(0, limit);
}

/** Books like `seed`, best first (a "Because you finished…" shelf). */
export function moreLike(seed: Book, candidates: Book[], exclude: Set<string>, limit = 12): Book[] {
  return candidates
    .filter((b) => b.id !== seed.id && !exclude.has(b.id))
    .map((b) => ({ b, s: similarity(seed, b) }))
    .filter(({ s }) => s > 0)
    .sort((x, y) => y.s - x.s || y.b.rating - x.b.rating)
    .slice(0, limit)
    .map(({ b }) => b);
}
