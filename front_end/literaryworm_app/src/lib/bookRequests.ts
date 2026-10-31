import { getBook, isAllowed } from "../data/books";
import type { Book, BookRequest, Profile, ProfileData } from "../types";

/**
 * Book requests: a Kids profile asks a grown-up for a catalog book rated above it; a yes opens
 * that one book for that profile. The same limit as the `book_requests` table.
 */
export const REQUESTS_MAX = 50;

export function requestFor(requests: BookRequest[], bookId: string): BookRequest | undefined {
  return requests.find((r) => r.bookId === bookId);
}

/** Whether a grown-up said yes to this book for the profile. */
export function approved(requests: BookRequest[], bookId: string): boolean {
  return requestFor(requests, bookId)?.status === "approved";
}

/** A catalog book this profile may open: rated for it, or a book a grown-up said yes to. */
export function mayOpen(book: Pick<Book, "id" | "ageRating">, profile: Pick<Profile, "ageRating">, requests: BookRequest[]): boolean {
  return isAllowed(book.ageRating, profile.ageRating) || (profile.ageRating === "kids" && approved(requests, book.id));
}

/** Kids profiles can ask for catalog books that aren't on their shelf. */
export function canAsk(book: Pick<Book, "ageRating"> | undefined, profile: Pick<Profile, "ageRating">): boolean {
  return Boolean(book) && profile.ageRating === "kids" && !isAllowed(book!.ageRating, "kids");
}

export interface WaitingRequest {
  profile: Profile;
  request: BookRequest;
  book: Book;
}

/** Every Kids profile's waiting requests for the grown-ups, oldest first (catalog books only). */
export function waitingRequests(profiles: Profile[], profileData: Record<string, ProfileData | undefined>): WaitingRequest[] {
  return answerable(profiles, profileData).filter((w) => w.request.status === "pending");
}

/** Every Kids profile's requests, waiting ones first, then the answered ones, newest answer first. */
export function answerable(profiles: Profile[], profileData: Record<string, ProfileData | undefined>): WaitingRequest[] {
  const rows = profiles
    .filter((p) => p.ageRating === "kids")
    .flatMap((profile) =>
      (profileData[profile.id]?.bookRequests ?? []).flatMap((request) => {
        const book = getBook(request.bookId);
        return book ? [{ profile, request, book }] : [];
      }),
    );
  const waiting = rows.filter((r) => r.request.status === "pending").sort((a, b) => a.request.createdAt - b.request.createdAt);
  const answered = rows.filter((r) => r.request.status !== "pending").sort((a, b) => (b.request.answeredAt ?? 0) - (a.request.answeredAt ?? 0));
  return [...waiting, ...answered];
}

/** Bell alerts for the grown-ups: one per waiting request, new from when it was asked. */
export function requestAlerts(waiting: WaitingRequest[]): { at: number; key: string; waiting: WaitingRequest }[] {
  return waiting.map((w) => ({ at: w.request.createdAt, key: `${w.profile.id}:${w.book.id}`, waiting: w }));
}

/** The books a grown-up said yes to, newest answer first, for the child's Home. */
export function approvedBooks(requests: BookRequest[]): Book[] {
  return requests
    .filter((r) => r.status === "approved")
    .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0))
    .map((r) => getBook(r.bookId))
    .filter((b): b is Book => Boolean(b));
}
