import type { Highlight, HighlightColor } from "../types";

/**
 * Shared highlights in a book club: a member's own highlight of the club's book, shared with the
 * club (`club_highlights`, migration 6565; the database copies the passage from the highlight).
 * Like posts, the ones past the reader's chapter stay hidden until they choose to see them
 * (`spoilerFreeUpTo()` in lib/clubs.ts gives `upTo`).
 */
export interface ClubHighlight {
  id: string;
  userId: string;
  author: string;
  highlightId: string;
  chapterIndex: number;
  quote: string;
  color: HighlightColor;
  note: string | null;
  createdAt: number;
}

/** The shared highlights a reader can see now (chapters up to `upTo`, in book order) and how many wait further on. */
export function splitShared(shared: ClubHighlight[], upTo: number): { visible: ClubHighlight[]; hidden: ClubHighlight[] } {
  const inOrder = [...shared].sort((a, b) => a.chapterIndex - b.chapterIndex || a.createdAt - b.createdAt);
  return { visible: inOrder.filter((h) => h.chapterIndex <= upTo), hidden: inOrder.filter((h) => h.chapterIndex > upTo) };
}

/** This reader's highlights of the club's book that aren't shared with the club yet, in book order. */
export function shareable(mine: Highlight[], shared: ClubHighlight[], bookId: string): Highlight[] {
  const already = new Set(shared.map((s) => s.highlightId));
  return mine
    .filter((h) => h.bookId === bookId && !already.has(h.id))
    .sort((a, b) => a.chapterIndex - b.chapterIndex || a.page - b.page || a.start - b.start);
}

/** A short label for a highlight in the share list: its chapter and the start of the passage. */
export function shareLabel(h: Pick<Highlight, "chapterIndex" | "quote">, chapterTitle: string | undefined, max = 60): string {
  const quote = h.quote.replace(/\s+/g, " ").trim();
  const short = quote.length > max ? `${quote.slice(0, max - 1).trimEnd()}…` : quote;
  return `${chapterTitle ?? `Chapter ${h.chapterIndex + 1}`}: “${short}”`;
}
