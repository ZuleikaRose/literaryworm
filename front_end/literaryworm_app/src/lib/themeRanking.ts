import type { Book, BookMood, Follow, Mood } from "../types";
import { type Seed, similarity } from "./recommend";

/**
 * The order of a theme's book ideas (lib/themeIdeas.ts), best for this profile first: books like
 * the ones it finished, loved, liked or favourited (recommend.ts's seeds, so Not for me and Didn't
 * finish pull down), books by authors and narrators it follows, and books like the ones it tagged
 * with the moods it uses most. Worked out in the browser, never stored.
 */

/** How much a followed author or narrator lifts a book. */
export const FOLLOW_LIFT = 1.5;
/** How much each book tagged with one of the profile's favourite moods counts, as a seed. */
export const MOOD_WEIGHT = 0.6;
/** How many of the most-used moods count as favourites. */
export const TOP_MOODS = 3;

/** The moods the profile tags books with most, most first (ties alphabetically). */
export function topMoods(moods: Record<string, BookMood>, n = TOP_MOODS): Mood[] {
  const counts = new Map<Mood, number>();
  for (const m of Object.values(moods)) for (const mood of m.moods) counts.set(mood, (counts.get(mood) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([mood]) => mood);
}

/** Seeds from the books tagged with a favourite mood. */
export function moodSeeds(moods: Record<string, BookMood>, find: (id: string) => Book | undefined): Seed[] {
  const top = new Set(topMoods(moods));
  const seeds: Seed[] = [];
  for (const [id, m] of Object.entries(moods)) {
    const book = find(id);
    const matching = m.moods.filter((mood) => top.has(mood)).length;
    if (book && matching) seeds.push({ book, weight: MOOD_WEIGHT * matching, reason: "liked" });
  }
  return seeds;
}

/** A score for each book (higher first); 0 when there's nothing to go on. */
export function themeRank(input: { seeds: Seed[]; moodSeeds: Seed[]; follows: Follow[] }): (book: Book) => number {
  const all = [...input.seeds, ...input.moodSeeds];
  const authors = new Set(input.follows.filter((f) => f.kind === "author").map((f) => f.name.toLowerCase()));
  const narrators = new Set(input.follows.filter((f) => f.kind === "narrator").map((f) => f.name.toLowerCase()));
  return (book) => {
    let score = 0;
    for (const seed of all) if (seed.book.id !== book.id) score += seed.weight * similarity(seed.book, book);
    if (authors.has(book.author.toLowerCase())) score += FOLLOW_LIFT;
    const narrator = book.narrator?.toLowerCase();
    if (narrator && narrators.has(narrator)) score += FOLLOW_LIFT;
    return score;
  };
}
