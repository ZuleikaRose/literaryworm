import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import type { PersonKind } from "./people";

/**
 * How many reader profiles follow an author or narrator, read through the `follower_count`
 * database function (a number, never who). Null without the backend or when it can't be read:
 * the page just leaves the count out.
 */
export async function fetchFollowerCount(kind: PersonKind, name: string): Promise<number | null> {
  if (!usesBackend) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/follower_count`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_name: name }),
    });
    if (!res.ok) return null;
    const count: unknown = await res.json();
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/**
 * Follower counts for several people at once (an author search's authors), through the
 * `follower_counts` database function: name → count. Null without the backend or when they can't
 * be read; the list just leaves the counts out.
 */
export async function fetchFollowerCounts(kind: PersonKind, names: string[]): Promise<Map<string, number> | null> {
  if (!usesBackend || names.length === 0) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/follower_counts`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_names: names.slice(0, 50) }),
    });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return null;
    const counts = new Map<string, number>();
    for (const row of rows as { name?: unknown; followers?: unknown }[]) {
      if (typeof row.name === "string" && typeof row.followers === "number") counts.set(row.name, row.followers);
    }
    return counts;
  } catch {
    return null;
  }
}

/**
 * The most-followed authors (or narrators), through the `most_followed` database function: names
 * and counts, never who, for people with at least two followers. Null without the backend or when
 * they can't be read; Home then leaves the row out.
 */
export async function fetchMostFollowed(kind: PersonKind, limit = 8): Promise<{ name: string; followers: number }[] | null> {
  if (!usesBackend) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/most_followed`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_limit: limit }),
    });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return null;
    return (rows as { name?: unknown; followers?: unknown }[])
      .filter((r): r is { name: string; followers: number } => typeof r.name === "string" && typeof r.followers === "number")
      .map((r) => ({ name: r.name, followers: r.followers }));
  } catch {
    return null;
  }
}
