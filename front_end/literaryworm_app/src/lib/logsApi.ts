import type { ReadingLog } from "../types";
import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";

/**
 * Public reading logs for one book, read straight from the `logs` table.
 *
 * Anyone may read logs (an RLS policy for anon and authenticated), and each log embeds only
 * its writer's display name from `profiles`. Nothing here touches `library_items`, which
 * stays owner-only: the book page lists every reader's logs without seeing any library.
 */

export const LOGS_PAGE_SIZE = 20;

export interface LogsPage {
  items: ReadingLog[];
  hasMore: boolean;
}

export class LogsApiError extends Error {}

const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;

interface Row {
  id: string;
  user_id: string;
  body: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
  author: { display_name: string; public_reader?: boolean } | null;
}

export async function fetchPublicLogs(bookId: string, page: number): Promise<LogsPage> {
  if (!usesBackend || !VOLUME_ID.test(bookId)) return { items: [], hasMore: false };
  const params = new URLSearchParams({
    // user_id is public on logs (it's how a reader finds their own); it reveals nothing about libraries.
    select: "id,user_id,body,rating,created_at,updated_at,author:profiles(display_name,public_reader)",
    volume_id: `eq.${bookId}`,
    order: "created_at.desc,id.desc",
    offset: String(page * LOGS_PAGE_SIZE),
    // One extra row tells us whether there's another page.
    limit: String(LOGS_PAGE_SIZE + 1),
  });
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/logs?${params}`, { headers: { apikey: PUBLISHABLE_KEY! } });
  } catch {
    throw new LogsApiError("You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok) throw new LogsApiError("We couldn't load reader logs right now. Try again in a moment.");
  const rows = (await res.json()) as Row[];
  return {
    items: rows.slice(0, LOGS_PAGE_SIZE).map((row) => ({
      id: row.id,
      bookId,
      profileId: null,
      userId: row.user_id,
      displayName: row.author?.display_name ?? "A reader",
      publicReader: Boolean(row.author?.public_reader),
      body: row.body,
      rating: row.rating,
      createdAt: Date.parse(row.created_at),
      updatedAt: Date.parse(row.updated_at),
    })),
    hasMore: rows.length > LOGS_PAGE_SIZE,
  };
}

/** A reader's page: their display name, if they turned their page on (null otherwise). */
export async function fetchReader(readerId: string): Promise<{ id: string; name: string } | null> {
  if (!usesBackend || !UUID.test(readerId)) return null;
  const params = new URLSearchParams({ select: "id,display_name,public_reader", id: `eq.${readerId}`, public_reader: "eq.true" });
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params}`, { headers: { apikey: PUBLISHABLE_KEY! } });
  } catch {
    throw new LogsApiError("You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok) throw new LogsApiError("We couldn't load this reader right now. Try again in a moment.");
  const rows = (await res.json()) as { id: string; display_name: string }[];
  return rows[0] ? { id: rows[0].id, name: rows[0].display_name } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const READER_FEED_SIZE = 30;

/**
 * The newest public logs by some readers (a reader page, or the readers a profile follows):
 * only readers who turned their page on, newest first.
 */
export async function fetchReaderLogs(readerIds: string[]): Promise<ReadingLog[]> {
  const ids = readerIds.filter((id) => UUID.test(id)).slice(0, 200);
  if (!usesBackend || ids.length === 0) return [];
  const params = new URLSearchParams({
    select: "id,user_id,volume_id,body,rating,created_at,updated_at,author:profiles!inner(display_name,public_reader)",
    user_id: `in.(${ids.join(",")})`,
    "author.public_reader": "eq.true",
    order: "created_at.desc,id.desc",
    limit: String(READER_FEED_SIZE),
  });
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/logs?${params}`, { headers: { apikey: PUBLISHABLE_KEY! } });
  } catch {
    throw new LogsApiError("You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok) throw new LogsApiError("We couldn't load reader logs right now. Try again in a moment.");
  const rows = (await res.json()) as (Row & { volume_id: string })[];
  return rows.map((row) => ({
    id: row.id,
    bookId: row.volume_id,
    profileId: null,
    userId: row.user_id,
    displayName: row.author?.display_name ?? "A reader",
    publicReader: true,
    body: row.body,
    rating: row.rating,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  }));
}
