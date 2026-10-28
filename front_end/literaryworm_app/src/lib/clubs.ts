import type { Book } from "../types";
import { chapterAt, chapterTimes } from "./reading";

/** A book club: one LiteraryWorm title, read together to a finish date. */
export interface Club {
  id: string;
  name: string;
  bookId: string;
  /** Local dates, YYYY-MM-DD. */
  startsOn: string;
  finishesOn: string;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
}

/** This account's own settings in a club: whether new posts alert it, and posts since it last looked. */
export interface ClubMembership {
  notify: boolean;
  /** Unread posts by others, per chapter (so chapters past the reader's place can be left out). */
  unread: Record<number, number>;
}

/** A new post heard while the app is open, with the club it's in. */
export interface ClubPostEvent {
  clubId: string;
  post: ClubPost;
}

export interface ClubMember {
  userId: string;
  name: string;
}

export interface ClubPost {
  id: string;
  userId: string;
  author: string;
  chapterIndex: number;
  body: string;
  createdAt: number;
}

export interface ClubDetail {
  club: Club;
  members: ClubMember[];
  posts: ClubPost[];
}

/** The same limits as the database. */
export const CLUB_NAME_MAX = 60;
export const CLUB_POST_MAX = 2000;
export const CLUB_DAYS_MAX = 366;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** A random invite code: 10 letters and digits, leaving out ones that look alike (0/O, 1/l/I). */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const isInviteCode = (value: string) => /^[A-Za-z0-9]{10}$/.test(value);

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/**
 * Where the club means to be today: the chapter that far through the book (by listening time)
 * as today is through the club's dates. Before the start it's the first chapter; after the
 * finish date, the last.
 */
export function clubChapterToday(club: Pick<Club, "startsOn" | "finishesOn">, book: Book, today: string): number {
  const span = toTime(club.finishesOn) - toTime(club.startsOn);
  const fraction = Math.min(1, Math.max(0, (toTime(today) - toTime(club.startsOn) + DAY_MS) / (span || 1)));
  const { starts, total } = chapterTimes(book);
  return fraction >= 1 ? book.chapters.length - 1 : chapterAt(starts, fraction * total);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });

/** "2026-11-25" → "Nov 25, 2026" (in the reader's own style). */
export const clubDate = (day: string) => dateFormat.format(new Date(`${day}T00:00:00Z`));

/** Days from `today` to the finish date (negative once it's past). */
export const daysLeft = (club: Pick<Club, "finishesOn">, today: string) => Math.round((toTime(club.finishesOn) - toTime(today)) / DAY_MS);

/**
 * The furthest chapter a reader can see posts about without spoilers: their place in the book
 * (the last chapter once finished), and always the first chapter, which is open to everyone.
 */
export function spoilerFreeUpTo(progress: { finished: boolean; chapterIndex: number } | undefined, book: Pick<Book, "chapters">): number {
  if (!progress) return 0;
  return progress.finished ? book.chapters.length - 1 : Math.max(0, progress.chapterIndex);
}

/** Unread posts the reader can see now: chapters up to `upTo`. */
export function unreadUpTo(unread: Record<number, number>, upTo: number): number {
  return Object.entries(unread).reduce((sum, [chapter, count]) => (Number(chapter) <= upTo ? sum + count : sum), 0);
}
