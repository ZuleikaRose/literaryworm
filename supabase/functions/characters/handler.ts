// POST /functions/v1/characters  { "id": "pride-and-prejudice", "chapter": 4 }
// Who's who in a public-domain title, as far as the reader has got: the characters met up to
// their chapter, each described only from the text so far, so the list can't spoil anything.
// Claude writes a book's list for a chapter the first time anyone asks; it's kept and every
// later reader at that chapter gets the same one. Public like `ask` (the demo household uses
// it without a session), so every field is validated, and new lists are rate limited per IP
// and capped for everyone each day.

import { contextText } from "../_shared/bookText.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const CHARACTERS_MAX = 40;
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 400;

export type CharacterBook = { title: string; author: string };

export interface Character {
  name: string;
  description: string;
  /** 1-based: the chapter the reader meets them in. */
  firstChapter: number;
}

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => CharacterBook | null;
  /** The book's chapters (the reader's text). */
  chapters: (id: string) => Promise<string[]>;
  /** The list kept for this book and chapter (0-based), or null if there isn't one yet. */
  cached: (id: string, chapter: number) => Promise<Character[] | null>;
  /**
   * Keeps a new list, never replacing one already kept, and returns the list now kept: when two
   * readers ask at once, the first list saved is the one everybody sees.
   */
  keep: (id: string, chapter: number, characters: Character[], model: string) => Promise<Character[]>;
  /** Asks Claude; returns what it wrote (checked by `checkCharacters`) and the model. */
  write: (input: { book: CharacterBook; chapter: number; chapterCount: number; text: string }) => Promise<{ characters: unknown; model: string }>;
  /** Rate limits a request that needs a new list. */
  rateLimit?: (req: Request) => Promise<void>;
};

/**
 * Claude's list, made safe to show: well-formed entries only, trimmed to the limits, one per
 * name, and never anyone first met after the reader's chapter (`chapter` is 0-based), in the
 * order they appear.
 */
export function checkCharacters(raw: unknown, chapter: number): Character[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { characters?: unknown }).characters) ? (raw as { characters: unknown[] }).characters : [];
  const seen = new Set<string>();
  const out: Character[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { name, description, first_chapter } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof description !== "string" || typeof first_chapter !== "number") continue;
    const cleanName = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    const cleanDescription = description.replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_MAX);
    const first = Math.trunc(first_chapter);
    // Someone the reader hasn't met yet is a spoiler, whatever Claude says.
    if (!cleanName || !cleanDescription || first < 1 || first > chapter + 1) continue;
    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: cleanName, description: cleanDescription, firstChapter: first });
    if (out.length >= CHARACTERS_MAX) break;
  }
  return out.sort((a, b) => a.firstChapter - b.firstChapter);
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    onlyKeys(body, ["id", "chapter"]);
    const id = parseVolumeId(body.id);
    const chapter = parseInt(body.chapter, "chapter", 0, 999);

    const book = deps.book(id);
    if (!book) throw new HttpError("not_found", "Who's who works with LiteraryWorm's public-domain titles.");

    const kept = await deps.cached(id, chapter);
    if (kept) return json(req, METHODS, { characters: kept, chapter });

    await deps.rateLimit?.(req);
    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    const written = await deps.write({ book, chapter, chapterCount: chapters.length, text: contextText(chapters, chapter) });
    const characters = checkCharacters(written.characters, chapter);
    if (characters.length === 0) throw new HttpError("upstream_error", "We couldn't put together who's who just now. Try again later.");
    // A failed save still shows this list; the next reader just asks again.
    const shown = await deps.keep(id, chapter, characters, written.model).catch((err) => {
      console.error("characters: couldn't keep a list", err);
      return characters;
    });
    return json(req, METHODS, { characters: shown, chapter });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
