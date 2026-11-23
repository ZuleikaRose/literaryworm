// POST /functions/v1/xray  { "id": "pride-and-prejudice", "chapter": 4 }
// X-Ray for a public-domain title, as far as the reader has got: the people, places and terms
// met up to their chapter, each described only from the text so far (it replaced Who's who and
// its `characters` function). Claude writes a book's X-Ray for a chapter the first time anyone
// asks (from the text up to that chapter only), it's kept, and every later reader at that chapter
// gets the same one. Public like `ask` (the demo household uses it without a session), so every
// field is validated before anything else, and new X-Rays are rate limited per IP and capped for
// everyone each day.
//
// What Claude writes is checked against the book's own text by our code before it's kept: an
// entry whose name never appears in the chapters up to the reader's is dropped (nothing
// invented), aliases are kept only where they appear too, and each entry's first chapter is
// where the text first names it, not what Claude says. Mentions are counted in the browser.

import { contextText } from "../_shared/bookText.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseInt, parseVolumeId } from "../_shared/validate.ts";

const METHODS = "POST";

export const KINDS = ["people", "places", "terms"] as const;
export type Kind = (typeof KINDS)[number];

/** Most entries of each kind kept (the table checks the same). */
export const KIND_MAX: Record<Kind, number> = { people: 40, places: 25, terms: 25 };
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 400;
export const ALIASES_MAX = 4;
/** An alias is a name, not a phrase: at most this many words. */
export const ALIAS_WORDS_MAX = 4;

export type XRayBook = { title: string; author: string };

export interface XRayEntry {
  name: string;
  /** Empty when what Claude wrote named something the reader hasn't met yet. */
  description: string;
  /** 1-based: the chapter whose text first names it. */
  firstChapter: number;
  /** Other names the text uses for it (each one found in the text). */
  aliases: string[];
}

export type XRay = Record<Kind, XRayEntry[]>;

export type Deps = {
  /** A public-domain catalog title, or null for any other id. */
  book: (id: string) => XRayBook | null;
  /** How many chapters the book has (_shared/chapterCounts.ts), or null when that isn't known. */
  chapterCount: (id: string) => number | null;
  /** The book's chapters (the reader's text): a download, unless the instance keeps it. */
  chapters: (id: string) => Promise<string[]>;
  /** The X-Ray kept for this book and chapter (0-based), or null if there isn't one yet. */
  cached: (id: string, chapter: number) => Promise<XRay | null>;
  /**
   * Keeps a new X-Ray, never replacing one already kept, and returns the one now kept: when two
   * readers ask at once, the first saved is the one everybody sees.
   */
  keep: (id: string, chapter: number, xray: XRay, model: string) => Promise<XRay>;
  /** Asks Claude; returns what it wrote (checked by `checkXRay`) and the model. */
  write: (input: { book: XRayBook; chapter: number; chapterCount: number; text: string }) => Promise<{ xray: unknown; model: string }>;
  /** Rate limits a request that needs a new X-Ray. */
  rateLimit?: (req: Request) => Promise<void>;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where a name is found: the exact words, not inside a longer word. A name that starts with a
 * small letter ("the entail") is also found at the start of a sentence ("The entail").
 * The same rule as `mentionPattern()` in the app's lib/xray.ts.
 */
export function mentionPattern(name: string): RegExp {
  const first = name[0] ?? "";
  const head = first.toLowerCase() === first && first.toUpperCase() !== first ? `[${escape(first)}${escape(first.toUpperCase())}]` : escape(first);
  const body = name.slice(1).split(/\s+/).map(escape).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${head}${body}(?![\\p{L}\\p{N}])`, "u");
}

/** The 1-based chapter whose text first names any of `names`, or null when none appears. */
export function firstChapterNaming(chapters: string[], names: string[]): number | null {
  const patterns = names.map(mentionPattern);
  const index = chapters.findIndex((text) => patterns.some((p) => p.test(text)));
  return index < 0 ? null : index + 1;
}

/** Starts with a small letter, in an alphabet that has capitals. */
const startsSmall = (s: string) => s[0] !== undefined && s[0] === s[0].toLowerCase() && s[0] !== s[0].toUpperCase();

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Capitalised words that start sentences or address people, never a character or a place.
const NOT_NAMES = new Set(
  (
    "I A An The And But Or Nor For So Yet If In On At To Of By As Is It Its He She His Her Him They Them Their We Our Us You Your My Me " +
    "This That These Those There Then Than Thus Here When Where What Which Who Whom Whose Why How Oh O Ah Alas Yes No Not Well Now Do Did " +
    "Be Was Were Are Am Have Has Had Will Would Shall Should May Might Must Can Could Let All Any Some One Two Every Each Both Such After " +
    "Before Upon With Without From Into Over Under Again Once Even Only Still Perhaps Indeed Very Most More Much Many Few Nothing " +
    "Chapter Book Part Volume Letter Mr Mrs Miss Ms Dr Sir Madam Lady Lord St Monday Tuesday Wednesday Thursday Friday Saturday Sunday " +
    "January February March April June July August September October November December God"
  ).split(" "),
);

const CAPITALISED = /(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{M}'’-]*/gu;

/**
 * Names the book uses only after the reader's chapter: capitalised words found by exact match in
 * the whole text, at least twice, rarely written in small letters (so not ordinary words that
 * start sentences), and nowhere in the chapters up to the reader's. A description naming one of
 * them gives away something still to come, whatever Claude knows of the book.
 */
export function laterNames(allChapters: string[], chapter: number): Set<string> {
  const counts = new Map<string, number>();
  const small = new Map<string, number>();
  for (const text of allChapters.slice(chapter + 1)) {
    for (const m of text.matchAll(CAPITALISED)) {
      const word = m[0].replace(/['’]s$/, "");
      if (word.length > 1 && !NOT_NAMES.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return new Set();
  const soFar = new Set<string>();
  for (const text of allChapters.slice(0, chapter + 1)) for (const m of text.matchAll(CAPITALISED)) soFar.add(m[0].replace(/['’]s$/, ""));
  for (const text of allChapters) {
    for (const m of text.matchAll(/(?<![\p{L}\p{N}])\p{Ll}[\p{L}\p{M}'’-]*/gu)) {
      const word = m[0];
      const capital = word[0].toUpperCase() + word.slice(1);
      if (counts.has(capital)) small.set(capital, (small.get(capital) ?? 0) + 1);
    }
  }
  const later = new Set<string>();
  for (const [word, n] of counts) if (n >= 2 && !soFar.has(word) && (small.get(word) ?? 0) * 5 < n) later.add(word);
  return later;
}

/** Whether a description names anything in `later` (a capitalised word of the text met only later). */
export function namesLater(description: string, later: Set<string>): boolean {
  for (const m of description.matchAll(CAPITALISED)) if (later.has(m[0].replace(/['’]s$/, ""))) return true;
  return false;
}

/**
 * Claude's X-Ray, made safe to show: well-formed entries only, trimmed to the limits, each name
 * once across all three kinds, only names the text up to the reader's chapter actually uses, with
 * the first chapter taken from the text (after unfit aliases are dropped), in the order the reader
 * meets them. `allChapters` is the whole book and `chapter` the reader's (0-based): a description
 * that names anyone or anything first met later is blanked (`laterNames()`).
 */
export function checkXRay(raw: unknown, allChapters: string[], chapter: number): XRay {
  const chapters = allChapters.slice(0, chapter + 1);
  const later = laterNames(allChapters, chapter);
  const out: XRay = { people: [], places: [], terms: [] };
  const seen = new Set<string>();
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const kind of KINDS) {
    const list = Array.isArray(body[kind]) ? (body[kind] as unknown[]) : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const { name, description, aliases } = item as Record<string, unknown>;
      const cleanName = clean(name, NAME_MAX);
      const cleanDescription = clean(description, DESCRIPTION_MAX);
      if (!cleanName || !cleanDescription || seen.has(cleanName.toLowerCase())) continue;
      // Only what the text itself names: anything else is invented, or a spoiler.
      const first = firstChapterNaming(chapters, [cleanName]);
      if (first === null) continue;
      const kept = (Array.isArray(aliases) ? aliases : [])
        .map((a) => clean(a, NAME_MAX))
        .filter((a, i, all) => a && a.toLowerCase() !== cleanName.toLowerCase() && all.indexOf(a) === i && !seen.has(a.toLowerCase()))
        .filter((a) => firstChapterNaming(chapters, [a]) !== null)
        .slice(0, ALIASES_MAX);
      seen.add(cleanName.toLowerCase());
      for (const a of kept) seen.add(a.toLowerCase());
      // A description naming someone or something not yet met is a spoiler: the entry stays, its description goes.
      out[kind].push({ name: cleanName, description: namesLater(cleanDescription, later) ? "" : cleanDescription, firstChapter: first, aliases: kept });
      if (out[kind].length >= KIND_MAX[kind]) break;
    }
  }
  // An alias that holds another entry's name ("my dear Mr. Bennet" for Mrs. Bennet) would count
  // that entry's mentions as this one's: it's dropped, as are long phrases that aren't names.
  // People and places are named: their aliases start with a capital ("my dear" isn't a name).
  for (const kind of KINDS) {
    for (const entry of out[kind]) {
      entry.aliases = entry.aliases.filter(
        (alias) =>
          alias.split(/\s+/).length <= ALIAS_WORDS_MAX &&
          (kind === "terms" || !startsSmall(alias)) &&
          !KINDS.some((k) => out[k].some((other) => other !== entry && mentionPattern(other.name).test(alias))),
      );
      // The first chapter from the name and the aliases that stayed.
      entry.firstChapter = firstChapterNaming(chapters, [entry.name, ...entry.aliases]) ?? entry.firstChapter;
    }
    out[kind].sort((a, b) => a.firstChapter - b.firstChapter);
  }
  return out;
}

const total = (x: XRay) => KINDS.reduce((n, k) => n + x[k].length, 0);

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
    if (!book) throw new HttpError("not_found", "X-Ray's AI descriptions work with LiteraryWorm's public-domain titles.");
    // The cheap checks first, with no download: the chapter against the catalog's count, then the
    // kept X-Ray (a kept row proves the chapter is real), served without the book's text.
    const count = deps.chapterCount(id);
    if (count !== null && chapter >= count) throw new HttpError("bad_request", `chapter must be below ${count}.`);
    const kept = await deps.cached(id, chapter);
    if (kept) return json(req, METHODS, { ...kept, chapter });

    // Only now the limits, before the book is downloaded and Claude asked, so both count.
    await deps.rateLimit?.(req);
    const chapters = await deps.chapters(id);
    if (chapter >= chapters.length) throw new HttpError("bad_request", `chapter must be below ${chapters.length}.`);
    const written = await deps.write({ book, chapter, chapterCount: chapters.length, text: contextText(chapters, chapter) });
    const xray = checkXRay(written.xray, chapters, chapter);
    if (total(xray) === 0) throw new HttpError("upstream_error", "We couldn't put together the X-Ray just now. Try again later.");
    // A failed save still shows this X-Ray; the next reader just asks again.
    const shown = await deps.keep(id, chapter, xray, written.model).catch((err) => {
      console.error("xray: couldn't keep an X-Ray", err);
      return xray;
    });
    return json(req, METHODS, { ...shown, chapter });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
