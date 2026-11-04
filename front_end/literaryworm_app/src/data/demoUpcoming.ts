import type { VolumeDetail } from "../lib/booksApi";
import type { Reminder } from "../types";
import { today } from "../lib/reading";

/**
 * The demo's sample upcoming book, so Remind Me and My Library → Reminders have something to show:
 * every catalog title is already out. It isn't a real book (its description says so) and exists
 * only in the demo: the id isn't a Google Books volume, BookDetail shows it for demo accounts only,
 * and it's out three weeks after the demo starts, so it's always upcoming.
 */
export const DEMO_UPCOMING_ID = "demo-upcoming-book";
export const DEMO_UPCOMING_TITLE = "The Lighthouse at Wren Cove";
export const DEMO_UPCOMING_AUTHOR = "Rowan Ellery";
const DAYS_AWAY = 21;

/** The day it's out: three weeks from `now`. */
export function demoUpcomingRelease(now = Date.now()): string {
  return today(new Date(now + DAYS_AWAY * 86_400_000));
}

/** Its details page, shaped like a Google Books title but with no Google link. */
export function demoUpcomingVolume(now = Date.now()): VolumeDetail {
  const release = demoUpcomingRelease(now);
  return {
    id: DEMO_UPCOMING_ID,
    title: DEMO_UPCOMING_TITLE,
    authors: [DEMO_UPCOMING_AUTHOR],
    cover: null,
    publishedYear: release.slice(0, 4),
    categories: ["Fiction"],
    pageCount: 320,
    subtitle: null,
    description:
      "A sample upcoming book for the LiteraryWorm demo, not a real title. A lighthouse keeper's daughter finds letters that were never sent. Choose Remind Me to be told the day a book like this comes out.",
    publisher: null,
    publishedDate: release,
    language: "en",
    averageRating: null,
    ratingsCount: null,
    previewLink: null,
    preview: null,
    mature: false,
  };
}

/** Avery's reminder for it. */
export function demoUpcomingReminder(now = Date.now()): Reminder {
  return { bookId: DEMO_UPCOMING_ID, title: DEMO_UPCOMING_TITLE, author: DEMO_UPCOMING_AUTHOR, releaseDate: demoUpcomingRelease(now) };
}
