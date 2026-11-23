import { PUBLISHABLE_KEY, SUPABASE_URL, usesBackend } from "./backend";
import { tk, tr } from "./i18n";
import { mentionPattern, metBy, type XRayItem } from "./xray";

/**
 * X-Ray's descriptions for a public-domain title up to the reader's chapter, written by Claude
 * on the server (the `xray` Edge Function) from the book's text so far and kept there, so it
 * can't spoil anything still to come. Mentions are counted in the browser (lib/xray.ts).
 */

export class XRayError extends Error {}

const FRIENDLY: Record<string, string> = {
  network: tk("We couldn't reach LiteraryWorm. Check your connection and try again."),
  rate_limited: tk("Lots of readers are asking right now. Wait a little, then try again."),
  upstream_error: tk("We couldn't put together the X-Ray just now. Try again later."),
  upstream_timeout: tk("Putting together the X-Ray took too long. Try again."),
};

/** Our words for an error code, in the reader's language (undefined for a code we have none for). */
const friendly = (code: string) => (Object.hasOwn(FRIENDLY, code) ? tr(FRIENDLY[code]) : undefined);

type Kind = "people" | "places" | "terms";
const KINDS: Kind[] = ["people", "places", "terms"];

const isEntry = (e: unknown): e is { name: string; description: string; firstChapter: number; aliases?: unknown } =>
  Boolean(e) &&
  typeof (e as { name?: unknown }).name === "string" &&
  typeof (e as { description?: unknown }).description === "string" &&
  typeof (e as { firstChapter?: unknown }).firstChapter === "number";

/** The function's answer as X-Ray items: well-formed entries only, and never anything met after `chapter` (0-based). */
export function itemsFrom(body: unknown, chapter: number): XRayItem[] {
  const items: XRayItem[] = [];
  for (const kind of KINDS) {
    const list = (body as Record<string, unknown> | null)?.[kind];
    if (!Array.isArray(list)) continue;
    for (const e of list.filter(isEntry)) {
      const aliases = Array.isArray(e.aliases) ? e.aliases.filter((a): a is string => typeof a === "string") : [];
      items.push({ name: e.name, kind, description: e.description, firstChapter: e.firstChapter, aliases });
    }
  }
  // As the function does: an alias holding another entry's name would count that entry's mentions.
  for (const entry of items) entry.aliases = entry.aliases.filter((a) => !items.some((other) => other !== entry && mentionPattern(other.name).test(a)));
  return metBy(items, chapter);
}

/** The people, places and terms met up to `chapter` (0-based), described by AI. */
export async function fetchXRay(bookId: string, chapter: number): Promise<XRayItem[]> {
  if (!usesBackend) throw new XRayError(friendly("network"));
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/xray`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId, chapter }),
    });
  } catch {
    throw new XRayError(friendly("network"));
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? "upstream_error";
    throw new XRayError((code === "bad_request" || code === "not_found" ? error?.message : friendly(code)) ?? friendly("upstream_error"));
  }
  if (!body || typeof body !== "object") throw new XRayError(friendly("upstream_error"));
  return itemsFrom(body, chapter);
}
