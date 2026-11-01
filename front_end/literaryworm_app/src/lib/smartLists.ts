import type { BookMood, Follow, LibraryEntry, Progress, RatingValue } from "../types";
import { FEEL_GOOD } from "./moods";

/**
 * Smart lists in My Library: lists that fill themselves from the library, reading progress,
 * ratings and the authors a profile follows. Worked out in the browser each time; nothing stored.
 */

export interface SmartList {
  id: "almost-there" | "waiting" | "followed" | "loved" | "feel-good";
  title: string;
  description: string;
  empty: string;
  bookIds: string[];
}

export interface SmartListInput {
  entries: LibraryEntry[];
  progress: Record<string, Progress>;
  ratings: Record<string, RatingValue>;
  /** Moods and pace the profile tagged (lib/moods.ts); missing means none. */
  moods?: Record<string, BookMood>;
  follows: Follow[];
  /** A book's authors: the catalog's, or the ones its library row keeps for Google titles. */
  authorsOf: (entry: LibraryEntry) => string[];
  now: number;
}

/** Books started but not opened for this long go on Waiting for you. */
export const STALLED_DAYS = 30;
const DAY_MS = 86_400_000;
const norm = (name: string) => name.trim().toLowerCase();

export function smartLists({ entries, progress, ratings, moods = {}, follows, authorsOf, now }: SmartListInput): SmartList[] {
  const reading = entries.filter((e) => e.status === "reading");
  const lastTouched = (e: LibraryEntry) => progress[e.bookId]?.updatedAt ?? e.updatedAt ?? e.addedAt;

  const almost = reading
    .filter((e) => (progress[e.bookId]?.fraction ?? 0) >= 0.5 && !progress[e.bookId]?.finished)
    .sort((a, b) => (progress[b.bookId]?.fraction ?? 0) - (progress[a.bookId]?.fraction ?? 0));

  const waiting = reading.filter((e) => now - lastTouched(e) >= STALLED_DAYS * DAY_MS).sort((a, b) => lastTouched(a) - lastTouched(b));

  const followed = new Set(follows.filter((f) => f.kind === "author").map((f) => norm(f.name)));
  const byFollowed = entries.filter((e) => authorsOf(e).some((a) => followed.has(norm(a)))).sort((a, b) => b.addedAt - a.addedAt);

  const loved = entries.filter((e) => ratings[e.bookId] === "love").sort((a, b) => (b.updatedAt ?? b.addedAt) - (a.updatedAt ?? a.addedAt));

  // Books tagged with a feel-good mood, the most feel-good moods first, then the latest added.
  const cheer = (e: LibraryEntry) => moods[e.bookId]?.moods.filter((m) => FEEL_GOOD.includes(m)).length ?? 0;
  const feelGood = entries.filter((e) => cheer(e) > 0).sort((a, b) => cheer(b) - cheer(a) || b.addedAt - a.addedAt);

  const ids = (list: LibraryEntry[]) => list.map((e) => e.bookId);
  return [
    { id: "almost-there", title: "Almost there", description: "Books you're more than halfway through.", empty: "Nothing past halfway yet.", bookIds: ids(almost) },
    {
      id: "waiting",
      title: "Waiting for you",
      description: `Books you started and haven't opened for ${STALLED_DAYS} days or more, longest first.`,
      empty: "Nothing's been waiting. Every book you've started has been opened lately.",
      bookIds: ids(waiting),
    },
    { id: "followed", title: "From authors you follow", description: "Books in your library by authors you follow.", empty: "Follow an author on their page, and their books in your library show here.", bookIds: ids(byFollowed) },
    { id: "loved", title: "Loved it", description: "Books you rated Love it.", empty: "Rate a book Love it on its page, and it shows here.", bookIds: ids(loved) },
    {
      id: "feel-good",
      title: "Feel-good picks",
      description: "Books you tagged funny, hopeful, lighthearted, relaxing or inspiring.",
      empty: "Tag a book's moods on its page (How did it feel?), and the cheerful ones show here.",
      bookIds: ids(feelGood),
    },
  ];
}
