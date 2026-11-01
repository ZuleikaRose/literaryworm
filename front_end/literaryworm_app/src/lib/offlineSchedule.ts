/**
 * Offline listening on a schedule: "keep the next N chapters on this device, on Wi-Fi only".
 * While a book with a schedule plays, ScheduledDownloads (above the routes) saves the chapter
 * playing and the ones after it up to N, and can remove chapters already played. The schedule is
 * per device, kept as a small note in the same `lw-books` cache as the books (lib/offline.ts), so
 * clearing the books (or signing out) forgets it too; nothing is stored on our servers.
 */
export interface ListenSchedule {
  /** How many chapters to keep, from the one playing (1–10). */
  chapters: number;
  /** Download only on Wi-Fi (or a wired connection) when the browser can tell. */
  wifiOnly: boolean;
  /** Remove chapters already played. */
  removePlayed: boolean;
}

export const SCHEDULE_CHAPTERS = [1, 3, 5, 10] as const;
export const DEFAULT_SCHEDULE: ListenSchedule = { chapters: 3, wifiOnly: true, removePlayed: false };

export const schedulePath = (bookId: string) => `/__lw/schedule/${encodeURIComponent(bookId)}.json`;

/** Fired on window when a book's schedule is saved, so the downloader and the settings re-read it. */
export const SCHEDULE_CHANGED = "lw:schedule-changed";
export const announceScheduleChange = (bookId: string) => window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGED, { detail: bookId }));

/** A schedule read back from the cache, checked; null when it isn't one. */
export function parseSchedule(raw: unknown): ListenSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.chapters !== "number" || !Number.isInteger(r.chapters) || r.chapters < 1 || r.chapters > 10) return null;
  return { chapters: r.chapters, wifiOnly: r.wifiOnly !== false, removePlayed: r.removePlayed === true };
}

/** What a connection allows, from the Network Information API where the browser has it. */
export interface ConnectionInfo {
  type?: string;
  saveData?: boolean;
}

/**
 * Whether to download now. Never with Data Saver on. With Wi-Fi only, not on a mobile connection;
 * browsers that don't say what the connection is (most desktop ones, and Safari) are treated as
 * Wi-Fi, which the setting's hint says.
 */
export function connectionAllows(connection: ConnectionInfo | undefined, schedule: Pick<ListenSchedule, "wifiOnly">): boolean {
  if (connection?.saveData) return false;
  if (!schedule.wifiOnly) return true;
  const type = connection?.type;
  return !type || type === "wifi" || type === "ethernet" || type === "unknown" || type === "other";
}

/** Whether this browser tells us the connection type at all (for the setting's hint). */
export const knowsConnectionType = (connection: ConnectionInfo | undefined) => Boolean(connection?.type);

/**
 * What to do now, playing `current` (0-based) of `total` chapters with `saved` on the device: the
 * chapters to download (in order) and, when the schedule removes played ones, those to remove.
 */
export function schedulePlan(schedule: ListenSchedule, current: number, total: number, saved: Set<number>): { download: number[]; remove: number[] } {
  if (total <= 0) return { download: [], remove: [] };
  const from = Math.min(Math.max(0, Math.floor(current)), total - 1);
  const until = Math.min(total, from + Math.max(1, Math.min(10, Math.floor(schedule.chapters))));
  const download: number[] = [];
  for (let i = from; i < until; i++) if (!saved.has(i)) download.push(i);
  const remove = schedule.removePlayed ? [...saved].filter((i) => i < from).sort((a, b) => a - b) : [];
  return { download, remove };
}
