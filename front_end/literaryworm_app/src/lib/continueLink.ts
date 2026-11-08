import { SITE_URL } from "./seo";

/**
 * "Continue on your phone" (components/ContinueOnPhone.tsx): a link, shown as a QR code, that opens
 * the same book at the same place on another device. The reader's place is its chapter and page
 * (0-based, as pages/Reader.tsx reads them with linkedPage()); the player's is whole seconds
 * (?at=, read by pages/Player.tsx with readAt()). A member's place also syncs once they're signed in.
 */
export function readerContinueUrl(bookId: string, chapter: number, page: number): string {
  return `${SITE_URL}/read/${encodeURIComponent(bookId)}?chapter=${Math.max(0, Math.floor(chapter))}&page=${Math.max(0, Math.floor(page))}`;
}

export function playerContinueUrl(bookId: string, seconds: number): string {
  return `${SITE_URL}/listen/${encodeURIComponent(bookId)}?at=${Math.max(0, Math.floor(seconds))}`;
}

/** The player's ?at= in seconds, or null when it's missing or not a sensible number. */
export function readAt(param: string | null, total: number): number | null {
  if (param === null || !/^\d{1,7}$/.test(param)) return null;
  const at = Number(param);
  return total > 0 ? Math.min(at, total) : at;
}

/** The demo's link for another device: the log-in page with Try the demo first (pages/SignIn.tsx reads ?demo=1). */
export function demoLink(): string {
  return `${SITE_URL}/signin?demo=1`;
}
