/**
 * Club polls: a club's owner offers 2 to 5 LiteraryWorm titles or their own uploads (named by title
 * and author only, migration 6803) and members vote on what to read
 * next (`club_polls`, `club_poll_votes`, migration 6637; the database checks the same rules).
 * Everyone in the club sees the votes. Closing keeps the winner: the most votes, a tie going to
 * the book offered first.
 */

import { tk, tr } from "./i18n";

export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 5;
export const POLL_QUESTION_MAX = 120;
/** The question a new poll starts with (shown translated in the form: t(POLL_DEFAULT_QUESTION)). */
export const POLL_DEFAULT_QUESTION = tk("What should we read next?");

export interface ClubPoll {
  id: string;
  clubId: string;
  createdBy: string;
  question: string;
  /** Catalog book ids or the owner's upload ids ("u-…"), in the order offered. */
  options: string[];
  /** An upload option's title and author (copied by the database from the owner's upload). */
  uploadLabels?: Record<string, { title: string; author: string }>;
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
  if (!q) return tr("Write a question, or keep the one offered.");
  if (q.length > POLL_QUESTION_MAX) return tr("Questions are up to {max} characters.", { max: POLL_QUESTION_MAX });
  if (options.length < POLL_OPTIONS_MIN) return tr("Add at least {min} books.", { min: POLL_OPTIONS_MIN });
  if (options.length > POLL_OPTIONS_MAX) return tr("A poll offers up to {max} books.", { max: POLL_OPTIONS_MAX });
  if (new Set(options).size !== options.length) return tr("Each book can be offered once.");
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

/** An option's title and author: a catalog book's, or an upload's as the poll keeps it. */
export function pollOptionLabel(poll: Pick<ClubPoll, "uploadLabels">, id: string, catalog: (id: string) => { title: string; author: string } | undefined): { title: string; author: string } | null {
  const upload = poll.uploadLabels?.[id];
  if (upload) return upload;
  const book = catalog(id);
  return book ? { title: book.title, author: book.author } : null;
}
