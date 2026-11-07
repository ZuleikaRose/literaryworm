/**
 * Voting on a club's pace (club_pace_votes, vote_club_pace()): each member votes for a number of
 * chapters a week; the owner chooses one, which clears the votes for a new round.
 */

/** Member id to the chapters a week they voted for. */
export type PaceVotes = Record<string, number>;

export type PaceCount = { perWeek: number; votes: number };

/** The paces voted for, most votes first, then the slower pace. */
export function paceTally(votes: PaceVotes): PaceCount[] {
  const counts = new Map<number, number>();
  for (const pace of Object.values(votes)) counts.set(pace, (counts.get(pace) ?? 0) + 1);
  return [...counts.entries()].map(([perWeek, n]) => ({ perWeek, votes: n })).sort((a, b) => b.votes - a.votes || a.perWeek - b.perWeek);
}

/** The pace with the most votes (a tie to the slower), or null with none. */
export function paceLeader(votes: PaceVotes): number | null {
  return paceTally(votes)[0]?.perWeek ?? null;
}

/** Votes with one member's vote set (null takes it back). */
export function withPaceVote(votes: PaceVotes, me: string, perWeek: number | null): PaceVotes {
  const next = { ...votes };
  if (perWeek === null) delete next[me];
  else next[me] = perWeek;
  return next;
}
