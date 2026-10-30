// A public-domain title's own text, for the functions that send Claude the book up to the
// reader's chapter (`ask`, `characters`). The texts are static files on the website
// (public/texts, built from Project Gutenberg); TEXTS_ORIGIN can point elsewhere, e.g. a
// preview deploy.

import { HttpError } from "./http.ts";

/** How much of the book goes to Claude: the most recent text up to the reader's chapter. */
export const CONTEXT_CHARS = 120_000;

/**
 * The text Claude gets: chapters up to and including the reader's, each headed with its number,
 * trimmed from the front to the most recent CONTEXT_CHARS so a long book stays cheap.
 */
export function contextText(chapters: string[], chapter: number): string {
  const parts = chapters.slice(0, chapter + 1).map((text, i) => `[Chapter ${i + 1}]\n${text}`);
  const joined = parts.join("\n\n");
  if (joined.length <= CONTEXT_CHARS) return joined;
  const cut = joined.slice(joined.length - CONTEXT_CHARS);
  // Start at a paragraph so the text doesn't open mid-sentence.
  const start = cut.indexOf("\n\n");
  return `[Earlier chapters left out]\n\n${start >= 0 ? cut.slice(start + 2) : cut}`;
}

const TEXTS_ORIGIN = (Deno.env.get("TEXTS_ORIGIN") ?? "https://www.literaryworm.com").replace(/\/$/, "");

// Kept between requests while the function instance is warm.
const texts = new Map<string, Promise<string[]>>();

async function download(id: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${TEXTS_ORIGIN}/texts/${encodeURIComponent(id)}.json`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError("upstream_error", "We couldn't load this book's text. Try again.");
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError("upstream_error", "We couldn't load this book's text. Try again.");
  }
  const body = (await res.json().catch(() => null)) as { chapters?: unknown } | null;
  const chapters = body?.chapters;
  if (!Array.isArray(chapters) || !chapters.every((c) => typeof c === "string")) {
    throw new HttpError("upstream_error", "We couldn't read this book's text. Try again later.");
  }
  return chapters as string[];
}

/** A public-domain title's chapters (the reader's text), fetched once per warm instance. */
export function bookChapters(id: string): Promise<string[]> {
  let pending = texts.get(id);
  if (!pending) {
    pending = download(id);
    texts.set(id, pending);
    pending.catch(() => texts.delete(id));
  }
  return pending;
}
