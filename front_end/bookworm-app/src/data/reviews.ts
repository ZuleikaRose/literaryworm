import type { Review } from "../types";

const day = 86_400_000;
const now = Date.now();

function seed(
  id: string,
  bookId: string,
  displayName: string,
  daysAgo: number,
  progressLabel: string,
  helpful: number,
  body: string,
): Review {
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id,
    bookId,
    profileId: null,
    displayName,
    initials,
    body,
    createdAt: now - daysAgo * day,
    progressLabel,
    helpful,
    helpfulBy: [],
    reportedBy: [],
  };
}

/** Sample community reviews. Names are fictional. */
export const seedReviews: Review[] = [
  seed("r1", "the-midnight-library", "Maya K.", 2, "Finished", 14,
    "The central idea stayed with me: regret can feel infinite, but so can possibility. A tender, quick read that landed at exactly the right moment."),
  seed("r2", "the-midnight-library", "Jonas Lee", 7, "Page 184", 6,
    "I like the episodic structure more than I expected. Each life is a small thought experiment, but Nora's voice keeps the book grounded."),
  seed("r3", "the-midnight-library", "Sofia Patel", 21, "Finished", 9,
    "Accessible and hopeful without pretending that change is easy. The swimming-pool chapter was my favourite."),
  seed("r4", "dune", "Theo Grant", 4, "Finished", 22,
    "The first hundred pages are a wall of names and politics, then it clicks and you can't put it down. The audiobook's pacing helped a lot."),
  seed("r5", "dune", "Ana Ruiz", 12, "Chapter 9", 3,
    "Listening at 1.25× on my commute. The world-building is dense but every detail pays off later."),
  seed("r6", "circe", "Hannah Cole", 5, "Finished", 11,
    "Miller makes a minor figure from the Odyssey into someone you'd follow anywhere. The island chapters are gorgeous."),
  seed("r7", "pride-and-prejudice", "Leo Martins", 30, "Finished", 18,
    "Funnier than I remembered from school. Mr Collins's proposal had me laughing out loud on the bus."),
  seed("r8", "the-wild-robot", "Ben & Ivy", 9, "Finished", 7,
    "We read this together at bedtime. My daughter now asks every robot vacuum if it is lonely."),
  seed("r9", "atomic-habits", "Priya S.", 3, "Chapter 6", 5,
    "The two-minute rule is the one idea I actually kept using. Some repetition, but it's easy to dip in and out."),
  seed("r10", "babel", "Marcus Bell", 15, "Finished", 8,
    "The footnotes are half the fun. Heavy going in the final third, in a way the book has earned."),
];
