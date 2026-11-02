/**
 * Club polls: a club's owner offers 2 to 5 LiteraryWorm titles and members vote on what to read
 * next (`club_polls`, `club_poll_votes`, migration 6637; the database checks the same rules).
 * Everyone in the club sees the votes. Closing keeps the winner: the most votes, a tie going to
 * the book offered first.
 */

export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 5;
export const POLL_QUESTION_MAX = 120;
export const POLL_DEFAULT_QUESTION = "What should we read next?";

export interface ClubPoll {
  id: string;
  clubId: string;
  createdBy: string;
  question: string;
  /** Catalog book ids, in the order offered. */
  options: string[];
  createdAt: number;
  closedAt: number | null;
  winner: string | null;
  /** Each member's vote: user id → option index. */
  votes: Record<string, number>;
}

/** Votes for each option, in order. */
export function tally(poll: Pick<ClubPoll, "options" | "votes">): number[] {
  const counts = poll.options.map(() => 0);
  for (const choice of Object.values(poll.votes)) if (choice >= 0 && choice < counts.length) counts[choice]++;
  return counts;
}

/** The book ahead now (or the winner once closed): most votes, a tie to the one offered first. */
export function leader(poll: Pick<ClubPoll, "options" | "votes" | "winner">): string {
  if (poll.winner) return poll.winner;
  const counts = tally(poll);
  let best = 0;
  counts.forEach((n, i) => {
    if (n > counts[best]) best = i;
  });
  return poll.options[best];
}

/** What's wrong with a new poll, or null: the same checks as the database. */
export function pollError(question: string, options: string[]): string | null {
  const q = question.trim();
  if (!q) return "Write a question, or keep the one offered.";
  if (q.length > POLL_QUESTION_MAX) return `Questions are up to ${POLL_QUESTION_MAX} characters.`;
  if (options.length < POLL_OPTIONS_MIN) return `Add at least ${POLL_OPTIONS_MIN} books.`;
  if (options.length > POLL_OPTIONS_MAX) return `A poll offers up to ${POLL_OPTIONS_MAX} books.`;
  if (new Set(options).size !== options.length) return "Each book can be offered once.";
  return null;
}

/**
 * Open polls for the bell: ones in clubs with alerts on that this member didn't start and hasn't
 * voted in yet, new from when they opened.
 */
export function pollAlerts(polls: ClubPoll[], notifyOff: (clubId: string) => boolean, myId: string, clubName: (clubId: string) => string) {
  return polls
    .filter((p) => p.closedAt === null && p.createdBy !== myId && !(myId in p.votes) && !notifyOff(p.clubId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((poll) => ({ poll, clubName: clubName(poll.clubId), at: poll.createdAt }));
}

export type PollAlert = ReturnType<typeof pollAlerts>[number];
