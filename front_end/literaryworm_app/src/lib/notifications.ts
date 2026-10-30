import { getBook } from "../data/books";
import type { AuthorNews, Progress, Reminder } from "../types";
import { type Club, type ClubMembership, spoilerFreeUpTo, unreadUpTo } from "./clubs";
import type { ListeningAlert } from "./planLimits";
import { today } from "./reading";
import { isOut } from "./release";

/**
 * What the notification bell shows for a profile: books from its reminders that are out (new
 * if they came out after it last opened the bell), new books from authors it follows (new if
 * found after that), and unread posts in its book clubs up to the reader's chapter, for clubs
 * with alerts on. Club posts keep their own read state: they stop counting when the club is
 * opened.
 */

export interface ClubNews {
  clubId: string;
  clubName: string;
  bookTitle: string;
  posts: number;
}

/** True when a released reminder came out after the bell was last opened (or it never was). */
export function isNewRelease(reminder: Reminder, seenAt: number | null, now = new Date()): boolean {
  if (!isOut(reminder.releaseDate, now)) return false;
  return seenAt === null || reminder.releaseDate > today(new Date(seenAt));
}

/** True when a followed author's book was found after the bell was last opened (or it never was). */
export const isNewAuthorBook = (news: AuthorNews, seenAt: number | null) => seenAt === null || news.foundAt > seenAt;

/** Released reminders, newest release first. */
export function releasedReminders(reminders: Reminder[], now = new Date()): Reminder[] {
  return reminders.filter((r) => isOut(r.releaseDate, now)).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.title.localeCompare(b.title));
}

/** Clubs with unread posts the reader may see (never past their place in the book), most first. */
export function clubNews(clubs: Club[], memberships: Record<string, ClubMembership>, progress: Record<string, Progress>): ClubNews[] {
  return clubs
    .flatMap((club) => {
      const membership = memberships[club.id];
      const book = getBook(club.bookId);
      if (!membership || membership.notify === false || !book) return [];
      const posts = unreadUpTo(membership.unread, spoilerFreeUpTo(progress[book.id], book));
      return posts > 0 ? [{ clubId: club.id, clubName: club.name, bookTitle: book.title, posts }] : [];
    })
    .sort((a, b) => b.posts - a.posts || a.clubName.localeCompare(b.clubName));
}

/** True when the household passed most of the month's listening after the bell was last opened. */
export const isNewListeningAlert = (alert: ListeningAlert | null, seenAt: number | null) => alert !== null && (seenAt === null || alert.crossedAt > seenAt);

/** The number on the bell: new releases, new books from followed authors, unread club posts and the listening heads-up. */
export function bellCount(
  reminders: Reminder[],
  seenAt: number | null,
  news: ClubNews[],
  authorNews: AuthorNews[] = [],
  now = new Date(),
  listening: ListeningAlert | null = null,
): number {
  return (
    (isNewListeningAlert(listening, seenAt) ? 1 : 0) +
    reminders.filter((r) => isNewRelease(r, seenAt, now)).length +
    authorNews.filter((n) => isNewAuthorBook(n, seenAt)).length +
    news.reduce((sum, n) => sum + n.posts, 0)
  );
}

/** The badge's text: "99+" past 99. */
export const badgeText = (count: number) => (count > 99 ? "99+" : String(count));

/** The bell button's name for screen readers. */
export const bellLabel = (count: number) => (count > 0 ? `Notifications, ${count} new` : "Notifications");
