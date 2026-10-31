import { getBook, isAllowed } from "../data/books";
import type { AgeRating, Book } from "../types";

/**
 * Up next: a profile's listening queue, catalog audiobooks in the order they'll play. The same
 * limit as `reader_profiles.up_next`.
 */
export const UP_NEXT_MAX = 50;

/** Only catalog titles with an audiobook can be queued. */
export function canQueue(book: Book | undefined): book is Book {
  return Boolean(book && book.source === "literaryworm" && book.formats.includes("audiobook"));
}

export function addToQueue(queue: string[], bookId: string): string[] {
  if (queue.includes(bookId)) return queue;
  return [...queue, bookId].slice(0, UP_NEXT_MAX);
}

export function removeFromQueue(queue: string[], bookId: string): string[] {
  return queue.filter((id) => id !== bookId);
}

/** Moves a book one place earlier (-1) or later (+1); at either end it stays. */
export function moveInQueue(queue: string[], bookId: string, by: -1 | 1): string[] {
  const from = queue.indexOf(bookId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= queue.length) return queue;
  const next = [...queue];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The first queued book this profile may hear, other than the one playing. */
export function nextQueued(queue: string[], ageRating: AgeRating, playingId?: string): Book | undefined {
  return queue
    .filter((id) => id !== playingId)
    .map((id) => getBook(id))
    .find((b): b is Book => canQueue(b) && isAllowed(b.ageRating, ageRating));
}
