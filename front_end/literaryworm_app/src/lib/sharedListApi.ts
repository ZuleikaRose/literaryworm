import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { isShareSlug } from "./collections";

/**
 * A custom list someone shared by link, for its public page. Read only through the
 * `shared_list` database function, which returns just the list's name, description, the
 * profile's name and its titles (never the account, library or history).
 */
export interface SharedList {
  name: string;
  description: string;
  /** The sharing profile's name. */
  owner: string;
  updatedAt: string;
  /** Book ids (catalog or Google Books), in the order they were added. */
  items: string[];
}

export class SharedListError extends Error {}

/** The shared list, or null when the link is wrong or sharing has stopped. */
/** The demo's sample shared list (a wishlist: see lib/wishlist.ts), served without the backend. */
export const DEMO_WISHLIST_SLUG = "demo-jordans-wishlist0";
const DEMO_WISHLIST: SharedList = {
  name: "Jordan's wishlist",
  description: "Classics I'd love to read next, for birthdays and holidays.",
  owner: "Jordan",
  updatedAt: "2026-11-01T18:00:00Z",
  items: ["persuasion", "jane-eyre", "middlemarch", "carmilla", "emma"],
};

export async function fetchSharedList(slug: string): Promise<SharedList | null> {
  if (slug === DEMO_WISHLIST_SLUG) return structuredClone(DEMO_WISHLIST);
  if (!isShareSlug(slug)) return null;
  if (!usesBackend) throw new SharedListError("Shared lists need the LiteraryWorm backend, which isn't set up in this copy of the app.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/shared_list`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
    });
  } catch {
    throw new SharedListError("We couldn't reach LiteraryWorm. Check your connection and try again.");
  }
  if (!res.ok) throw new SharedListError("We couldn't open this list right now. Try again in a moment.");
  const body: unknown = await res.json().catch(() => null);
  return (body as SharedList | null) ?? null;
}
