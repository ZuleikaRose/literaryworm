import type { ReadingLog } from "../types";

/**
 * The demo's sample reader: Jordan (whose wishlist the demo also has, lib/sharedListApi.ts), with a
 * few logs, so My Library → Readers shows what following a reader looks like. Not a real account:
 * the id isn't a UUID, so it never reaches Supabase, and it has no reader page.
 */
export const DEMO_READER_ID = "demo-reader-jordan";
export const DEMO_READER_NAME = "Jordan";

export function demoReaderLogs(now: number): ReadingLog[] {
  const day = 86_400_000;
  const log = (id: string, bookId: string, daysAgo: number, rating: number | null, body: string): ReadingLog => ({
    id: `demo-reader-log-${id}`,
    bookId,
    profileId: null,
    userId: DEMO_READER_ID,
    displayName: DEMO_READER_NAME,
    body,
    rating,
    publicReader: false,
    createdAt: now - daysAgo * day,
    updatedAt: now - daysAgo * day,
  });
  return [
    log("1", "the-midnight-library", 1, 5, "Read it in two evenings. The library between life and death is such a kind idea, and it never gets sentimental."),
    log("2", "frankenstein", 4, 4, "Listened to the LibriVox recording with the read-along on. The creature's chapters are the heart of it."),
    log("3", "anne-of-green-gables", 9, 5, "A reread. Anne's apologies to Mrs Lynde still make me laugh out loud."),
  ];
}
