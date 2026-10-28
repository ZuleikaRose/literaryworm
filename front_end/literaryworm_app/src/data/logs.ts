import type { ReadingLog } from "../types";

const day = 86_400_000;
const now = Date.now();

function seed(
  id: string,
  bookId: string,
  displayName: string,
  daysAgo: number,
  rating: number | null,
  body: string,
): ReadingLog {
  const at = now - daysAgo * day;
  return { id, bookId, profileId: null, displayName, body, rating, createdAt: at, updatedAt: at };
}

/** Sample community logs for the LiteraryWorm catalog. Names are fictional. */
export const seedLogs: ReadingLog[] = [
  seed("log-1", "the-midnight-library", "Maya K.", 2, 5,
    "The central idea stayed with me: regret can feel infinite, but so can possibility. A tender, quick read that landed at exactly the right moment."),
  seed("log-2", "the-midnight-library", "Jonas Lee", 7, 4,
    "I like the episodic structure more than I expected. Each life is a small thought experiment, but Nora's voice keeps the book grounded."),
  seed("log-3", "the-midnight-library", "Sofia Patel", 21, null,
    "Accessible and hopeful without pretending that change is easy. The swimming-pool chapter was my favorite."),
  seed("log-4", "dune", "Theo Grant", 4, 5,
    "The first hundred pages are a wall of names and politics, then it clicks and you can't put it down. The audiobook's pacing helped a lot."),
  seed("log-5", "dune", "Ana Ruiz", 12, 4,
    "Listening at 1.25× on my commute. The world-building is dense but every detail pays off later."),
  seed("log-6", "circe", "Hannah Cole", 5, 5,
    "Miller makes a minor figure from the Odyssey into someone you'd follow anywhere. The island chapters are gorgeous."),
  seed("log-7", "pride-and-prejudice", "Leo Martins", 30, 4,
    "Funnier than I remembered from school. Mr Collins's proposal had me laughing out loud on the bus."),
  seed("log-8", "the-wild-robot", "Ben & Ivy", 9, 5,
    "We read this together at bedtime. My daughter now asks every robot vacuum if it is lonely."),
  seed("log-9", "atomic-habits", "Priya S.", 3, 3,
    "The two-minute rule is the one idea I actually kept using. Some repetition, but it's easy to dip in and out."),
  seed("log-10", "babel", "Marcus Bell", 15, 4,
    "The footnotes are half the fun. Heavy going in the final third, in a way the book has earned."),
];

/** A log's body runs from 1 to 5000 characters (the same check as the database). */
export const LOG_MAX = 5000;

export const readingStatusLabel = {
  want_to_read: "Want to read",
  reading: "Reading",
  finished: "Finished",
} as const;
