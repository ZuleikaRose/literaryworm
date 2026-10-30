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
