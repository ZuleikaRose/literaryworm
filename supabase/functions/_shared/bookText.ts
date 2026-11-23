// A public-domain title's own text, for the functions that send Claude the book up to the
// reader's chapter (`ask`, `xray`). The texts are static files on the website
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

/**
 * Books kept between requests while the function instance is warm: at most TEXTS_KEPT books and
 * TEXTS_KEPT_CHARS characters, the least recently used dropped first, so a run of requests for
 * many different books can't fill the instance's memory.
 */
export const TEXTS_KEPT = 4;
export const TEXTS_KEPT_CHARS = 8_000_000;

type Kept = { pending: Promise<string[]>; chars: number };
const texts = new Map<string, Kept>();

const keptChars = () => [...texts.values()].reduce((n, k) => n + k.chars, 0);

/** Drops the least recently used books until the cache is within both bounds. */
function trim() {
  for (const id of texts.keys()) {
    if (texts.size <= TEXTS_KEPT && keptChars() <= TEXTS_KEPT_CHARS) return;
    texts.delete(id);
  }
}

/** How many books are kept now (for the tests). */
export const textsKept = () => texts.size;

/** Forgets every kept book (for the tests). */
export const forgetTexts = () => texts.clear();

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

/**
 * A public-domain title's chapters (the reader's text), fetched once per warm instance and kept
 * within the cache's bounds. Callers check the chapter (_shared/chapterCounts.ts) and rate-limit
 * before calling this, so a download always counts against their limits.
 */
export async function bookChapters(id: string): Promise<string[]> {
  const kept = texts.get(id);
  if (kept) {
    // Most recently used goes last.
    texts.delete(id);
    texts.set(id, kept);
    return kept.pending;
  }
  const entry: Kept = { pending: download(id), chars: 0 };
  texts.set(id, entry);
  trim();
  try {
    const chapters = await entry.pending;
    entry.chars = chapters.reduce((n, c) => n + c.length, 0);
    trim();
    return chapters;
  } catch (err) {
    if (texts.get(id) === entry) texts.delete(id);
    throw err;
  }
}
