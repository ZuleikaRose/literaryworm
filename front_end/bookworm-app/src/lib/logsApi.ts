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
  body: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
  author: { display_name: string } | null;
}

export async function fetchPublicLogs(bookId: string, page: number): Promise<LogsPage> {
  if (!usesBackend || !VOLUME_ID.test(bookId)) return { items: [], hasMore: false };
  const params = new URLSearchParams({
    select: "id,body,rating,created_at,updated_at,author:profiles(display_name)",
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
      displayName: row.author?.display_name ?? "A reader",
      body: row.body,
      rating: row.rating,
      createdAt: Date.parse(row.created_at),
      updatedAt: Date.parse(row.updated_at),
    })),
    hasMore: rows.length > LOGS_PAGE_SIZE,
  };
}
