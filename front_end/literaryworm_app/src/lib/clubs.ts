import type { Book, UploadedBook } from "../types";
import type { ClubMeeting } from "./clubCalendar";
import { activeLanguage, dateLocale } from "./i18n";
import { chapterAt, chapterTimes } from "./reading";
import { isUploadId, uploadToBook } from "./uploadBook";

/**
 * A book club: one book read together to a finish date. The book is a LiteraryWorm title, or a book
 * the owner uploaded (a DRM-free EPUB, perhaps bought elsewhere): uploads are private copies, so the
 * club keeps only its title and author, and each member reads their own upload of it (`myCopy`).
 */
export interface Club {
  id: string;
  name: string;
  /** A catalog id, or the owner's upload id ("u-…") for an uploaded book. */
  bookId: string;
  /** An uploaded book's title and author (book_clubs.book_title, book_author); null for a catalog title. */
  bookTitle?: string | null;
  bookAuthor?: string | null;
  /** This account's own copy of an uploaded book (club_members.own_copy); null until linked. */
  myCopy?: string | null;
  /** Local dates, YYYY-MM-DD. */
  startsOn: string;
  finishesOn: string;
  inviteCode: string;
  ownerId: string;
  memberCount: number;
  /** A buddy read: a club for two, started from a book's page (book_clubs.buddy, migration 6612). */
  buddy?: boolean;
  /** The reading schedule's chapters a week (lib/clubSchedule.ts); null or missing when there's none. */
  chaptersPerWeek?: number | null;
  /** Natural-voice minutes a month the owner gives each member for an uploaded book (lib/clubVoice.ts); null for none. */
  voiceMinutesPerMember?: number | null;
}

/** How many readers a buddy read takes (join_club() checks the same). */
export const BUDDY_READERS = 2;
/** How long a new buddy read runs before its finish date; it can be changed like any club's. */
export const BUDDY_DAYS = 30;

/** "Buddy read: Dracula", within a club name's 60 characters. */
export function buddyName(title: string): string {
  // Saved as the club's name, which both readers see: kept in English like other saved text.
  const name = `Buddy read: ${title.trim()}`;
  return name.length <= 60 ? name : `${name.slice(0, 59).trimEnd()}…`;
}

/** A new buddy read's finish date: BUDDY_DAYS after `day` (YYYY-MM-DD). */
export const buddyFinish = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + BUDDY_DAYS * 86_400_000).toISOString().slice(0, 10);

/** True while a buddy read is waiting for its second reader. */
export const buddyOpen = (club: Pick<Club, "buddy" | "memberCount">) => Boolean(club.buddy) && club.memberCount < BUDDY_READERS;

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
  /** Meetings the owner has scheduled, soonest first. */
  meetings: ClubMeeting[];
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

/** "2026-11-25" → "Nov 25, 2026" (in the reader's own style, or the language chosen). */
export const clubDate = (day: string) =>
  new Intl.DateTimeFormat(activeLanguage() === "en" ? undefined : dateLocale(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

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

/** True when the club reads a book its owner uploaded, rather than a LiteraryWorm title. */
export const isUploadClub = (club: Pick<Club, "bookId">) => isUploadId(club.bookId);

/**
 * The book this reader reads for the club: the catalog title, or for an uploaded book their own
 * linked copy among `uploads` (undefined until they link one). Its id is the one their progress,
 * highlights and spoiler protection go by.
 */
export function clubBook(club: Pick<Club, "bookId" | "myCopy">, uploads: UploadedBook[], catalog: (id: string) => Book | undefined): Book | undefined {
  if (!isUploadClub(club)) return catalog(club.bookId);
  const copy = club.myCopy ? uploads.find((u) => u.id === club.myCopy) : undefined;
  return copy ? uploadToBook(copy) : undefined;
}

/** The book's name for lists and headings: the uploaded title, the catalog title, or a stand-in. */
export function clubBookTitle(club: Pick<Club, "bookId" | "bookTitle">, catalog: (id: string) => Book | undefined): string {
  return (isUploadClub(club) ? club.bookTitle : catalog(club.bookId)?.title) ?? "A LiteraryWorm title";
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** True when every word of `query` is in the title or author (accents and case ignored). */
export function matchesBook(book: { title: string; author: string }, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  const hay = ` ${fold(`${book.title} ${book.author}`)} `;
  return words.every((w) => hay.includes(` ${w}`));
}

/**
 * Uploads to offer as a member's copy of the club's book, filtered by `query`: copies with the same
 * title (and author, when both have one) first, then the rest A–Z.
 */
export function copyChoices(uploads: UploadedBook[], club: Pick<Club, "bookTitle" | "bookAuthor">, query = ""): UploadedBook[] {
  const title = fold(club.bookTitle ?? "");
  const author = fold(club.bookAuthor ?? "");
  const score = (u: UploadedBook) => (fold(u.title) === title ? 2 : 0) + (author && fold(u.author) === author ? 1 : 0);
  return uploads
    .filter((u) => matchesBook(u, query))
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title));
}
