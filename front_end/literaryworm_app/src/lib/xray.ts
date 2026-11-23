import type { Book, Profile } from "../types";
import type { ReaderPage } from "./reading";

/**
 * X-Ray: the people, places and terms in a book so far, how often and where the text names
 * them, filtered to the chapter open now or the book so far. What each one is comes from
 * Claude (the `xray` Edge Function, public-domain titles), from the demo's sample written ahead
 * (data/demoXRay.ts), or, on this device with no AI, from the names that recur in the text
 * (`localNames()`). Mentions are always counted here, in the book's own text, by exact name:
 * never by AI. Nothing past the reader's chapter is looked at or shown.
 */

export type XRayKind = "people" | "places" | "terms" | "names";
export const XRAY_KINDS: XRayKind[] = ["people", "places", "terms", "names"];

export interface XRayItem {
  name: string;
  kind: XRayKind;
  /** What the reader knows about it so far; null for names found on this device. */
  description: string | null;
  /** 1-based: the chapter it was first named in, as the source says (the text decides in the end). */
  firstChapter: number;
  /** Other names the text uses for it, matched the same way. */
  aliases: string[];
}

/** Mentions on one page of the reader. */
export interface PageMentions {
  /** Index into the reader's pages, to go there. */
  index: number;
  chapterIndex: number;
  page: number;
  count: number;
}

export interface XRayRow extends XRayItem {
  /** Pages with at least one mention, in the chosen scope, in order. */
  pages: PageMentions[];
  /** Every mention in the chosen scope. */
  total: number;
  /** 1-based: the chapter the text first names it in (up to the reader's). */
  firstMet: number;
}

/** "chapter": the chapter open now; "sofar": every chapter up to and including it. */
export type XRayScope = "chapter" | "sofar";

/** How X-Ray works for this book and profile. */
export type XRayMode =
  /** Claude's descriptions from the `xray` function, with mentions counted here. */
  | "ai"
  /** The demo's sample, written ahead for its books (no network). */
  | "demo"
  /** Names found on this device, no AI and nothing sent. */
  | "local"
  /** No text to look through (sample pages only). */
  | "none";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where a name is found: the exact words, not inside a longer word, any run of spaces or a line
 * break between its words. A name that starts with a small letter ("the entail") is also found
 * at the start of a sentence ("The entail"). The same rule as the `xray` function's.
 */
export function mentionPattern(name: string): RegExp {
  const first = name[0] ?? "";
  const head = first.toLowerCase() === first && first.toUpperCase() !== first ? `[${escape(first)}${escape(first.toUpperCase())}]` : escape(first);
  const body = name.slice(1).split(/\s+/).map(escape).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${head}${body}(?![\\p{L}\\p{N}])`, "gu");
}

const startsSmall = (s: string) => s[0] !== undefined && s[0] === s[0].toLowerCase() && s[0] !== s[0].toUpperCase();
const oneSpace = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * One pattern for many names: longest first, so where two start at the same place the longer
 * wins, behind a lookahead for the names' first letters, which lets the engine skip everything
 * else quickly (about 50 ms for 450 names over 2.7 million characters in Node).
 */
function namesPattern(names: string[]): RegExp {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const firsts = new Set<string>();
  const alternatives = sorted.map((name) => {
    const first = name[0];
    firsts.add(first);
    if (startsSmall(name)) firsts.add(first.toUpperCase());
    const head = startsSmall(name) ? `[${escape(first)}${escape(first.toUpperCase())}]` : escape(first);
    return head + name.slice(1).split(" ").map(escape).join("\\s+");
  });
  return new RegExp(`(?=[${[...firsts].map(escape).join("")}])(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/** Each item's mentions by page index (pages up to the reader's chapter), aligned with the items. */
export type MentionIndex = Map<number, number>[];

/**
 * Every item's mentions, page by page, up to the reader's chapter, in ONE pass over that text:
 * each place in the text is one mention of one item (the longest name there wins, so "Mrs.
 * Bennet" isn't also a mention of an item called "Bennet"). Exact names and aliases only.
 */
export function mentionIndex(items: Pick<XRayItem, "name" | "aliases">[], pages: ReaderPage[], chapterIndex: number): MentionIndex {
  const counts: MentionIndex = items.map(() => new Map());
  const owner = new Map<string, number>();
  const names: string[] = [];
  items.forEach((item, i) => {
    for (const raw of [item.name, ...item.aliases]) {
      const name = oneSpace(raw);
      if (!name || owner.has(name)) continue;
      owner.set(name, i);
      names.push(name);
      // "the entail" is also "The entail" at the start of a sentence.
      if (startsSmall(name)) {
        const capital = name[0].toUpperCase() + name.slice(1);
        if (!owner.has(capital)) owner.set(capital, i);
      }
    }
  });
  if (names.length === 0) return counts;
  const starts: number[] = [];
  const pageOf: number[] = [];
  const parts: string[] = [];
  let length = 0;
  pages.forEach((p, i) => {
    if (p.chapterIndex > chapterIndex) return;
    const text = pageText(p);
    starts.push(length);
    pageOf.push(i);
    parts.push(text);
    length += text.length + 2;
  });
  const text = parts.join("\n\n");
  let at = 0;
  for (const m of text.matchAll(namesPattern(names))) {
    while (at + 1 < starts.length && starts[at + 1] <= m.index) at++;
    const item = owner.get(oneSpace(m[0]));
    if (item === undefined) continue;
    const page = pageOf[at];
    counts[item].set(page, (counts[item].get(page) ?? 0) + 1);
  }
  return counts;
}

/**
 * How many times any of `names` is named in `text`. Overlapping names ("Bennet" inside
 * "Mrs. Bennet") count once: the longest at each place wins.
 */
export function countMentions(text: string, names: string[]): number {
  const [found] = mentionIndex([{ name: names[0] ?? "", aliases: names.slice(1) }], [{ chapterIndex: 0, page: 0, paragraphs: [text] }], 0);
  return [...found.values()].reduce((n, c) => n + c, 0);
}

const pageText = (p: ReaderPage) => (p.paragraphs ?? []).join("\n");

/** Whether the pages are the book's own text (sample pages have no paragraphs of their own). */
export const hasRealText = (pages: ReaderPage[]) => pages.length > 0 && pages.every((p) => Array.isArray(p.paragraphs));

/** Only what the reader has met by `chapterIndex` (0-based): the spoiler cut, as the server's. */
export const metBy = <T extends { firstChapter: number }>(items: T[], chapterIndex: number): T[] => items.filter((i) => i.firstChapter >= 1 && i.firstChapter <= chapterIndex + 1);

/**
 * The X-Ray's rows for the reader at `chapterIndex`: each item met so far with its mentions in
 * the scope, counted in the pages' own text. In "chapter" only items named in this chapter are
 * listed; in "sofar" every item met so far is (with no mentions when the text never names it
 * exactly). Most-mentioned first, then in the order they were met. Pass the `index` from
 * `mentionIndex()` for these items to reuse one pass over the text across scopes and tabs.
 */
export function xrayRows(items: XRayItem[], pages: ReaderPage[], chapterIndex: number, scope: XRayScope, index: MentionIndex = mentionIndex(items, pages, chapterIndex)): XRayRow[] {
  const rows: XRayRow[] = [];
  items.forEach((item, i) => {
    if (!(item.firstChapter >= 1 && item.firstChapter <= chapterIndex + 1)) return;
    const byPage = [...(index[i] ?? new Map<number, number>()).entries()].sort((a, b) => a[0] - b[0]);
    // The text decides when it was first met: never later than the reader's chapter.
    const first = byPage.length > 0 ? pages[byPage[0][0]] : null;
    if (!first && item.description === null) return;
    const found: PageMentions[] = byPage
      .filter(([page]) => scope === "sofar" || pages[page].chapterIndex === chapterIndex)
      .map(([page, count]) => ({ index: page, chapterIndex: pages[page].chapterIndex, page: pages[page].page, count }));
    if (scope === "chapter" && found.length === 0) return;
    rows.push({ ...item, pages: found, total: found.reduce((n, f) => n + f.count, 0), firstMet: first ? first.chapterIndex + 1 : item.firstChapter });
  });
  return rows.sort((a, b) => b.total - a.total || a.firstMet - b.firstMet || a.name.localeCompare(b.name));
}

/** A row's mentions by chapter (for "sofar") or by page (for "chapter"): the mentions bar. */
export interface MentionStop {
  /** 0-based chapter or page within the chapter. */
  at: number;
  count: number;
  /** The reader's page index of the first mention there, or null when there is none. */
  index: number | null;
}

/**
 * One stop per chapter up to the reader's ("sofar"), or per page of the reader's chapter
 * ("chapter"), with the mentions there; stops without any are kept, so the bar shows where
 * the name is quiet too.
 */
export function mentionStops(row: Pick<XRayRow, "pages">, pages: ReaderPage[], chapterIndex: number, scope: XRayScope): MentionStop[] {
  if (scope === "sofar") {
    return Array.from({ length: chapterIndex + 1 }, (_, at) => {
      const here = row.pages.filter((p) => p.chapterIndex === at);
      return { at, count: here.reduce((n, p) => n + p.count, 0), index: here[0]?.index ?? null };
    });
  }
  const pagesInChapter = pages.filter((p) => p.chapterIndex === chapterIndex).length;
  return Array.from({ length: pagesInChapter }, (_, at) => {
    const here = row.pages.find((p) => p.chapterIndex === chapterIndex && p.page === at);
    return { at, count: here?.count ?? 0, index: here?.index ?? null };
  });
}

// Capitalised words that start sentences, address people or name days, not characters or places.
const NOT_NAMES = new Set(
  (
    "I A An The And But Or Nor For So Yet If In On At To Of By As Is It Its He She His Her Him They Them Their We Our Us You Your My Me Mine " +
    "This That These Those There Then Than Thus Here When Where What Which Who Whom Whose Why How Oh O Ah Alas Yes No Not Nay Well Now Do Does Did " +
    "Be Been Was Were Are Am Have Has Had Will Would Shall Should May Might Must Can Could Let All Any Some One Two Three Every Each Both Such " +
    "After Before Upon With Without From Into Over Under Again Once Even Only Still Perhaps Indeed Very Most More Much Many Few Nothing Something " +
    "Chapter Book Part Volume Letter Mr Mrs Miss Ms Dr Sir Madam Madame Lady Lord St Monday Tuesday Wednesday Thursday Friday Saturday Sunday " +
    "January February March April June July August September October November December God English French German Italian Spanish " +
    "Ladyship Majesty Highness Sire Heaven"
  ).split(" "),
);
const TITLES = new Set(["Mr", "Mrs", "Miss", "Ms", "Dr", "Sir", "Lady", "Lord", "St", "Captain", "Colonel", "Uncle", "Aunt", "Madame", "Monsieur", "Mademoiselle", "Señor", "Señora", "Herr", "Frau"]);

/** How often a capitalised name must recur before it's listed. */
export const LOCAL_MIN_MENTIONS = 3;
/** Most names listed. */
export const LOCAL_MAX = 40;

/**
 * Names found on this device, with no AI: runs of capitalised words (with a title such as
 * "Mr." kept in front) that recur at least LOCAL_MIN_MENTIONS times in the text up to the
 * reader's chapter, aren't only ever the first word of a sentence, and are rarely written in
 * small letters (so ordinary words that start sentences are left out). A word that is nearly
 * always part of a longer name ("Darcy" in "Mr. Darcy") is left to the longer one. Works for
 * alphabets with capital letters; other scripts give no names.
 */
export function localNames(pages: ReaderPage[], chapterIndex: number): XRayItem[] {
  type Seen = { count: number; inside: number; inLonger: number; firstChapter: number };
  const seen = new Map<string, Seen>();
  const lower = new Map<string, number>();
  const note = (name: string, chapter: number) => {
    const entry = seen.get(name) ?? { count: 0, inside: 0, inLonger: 0, firstChapter: chapter };
    seen.set(name, entry);
    return entry;
  };
  const isTitle = (w: string) => TITLES.has(w.replace(/\.$/, ""));
  const run = /\p{Lu}[\p{L}\p{M}'’-]*\.?(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]*\.?)*/gu;
  for (const p of pages) {
    if (p.chapterIndex > chapterIndex) continue;
    const chapter = p.chapterIndex + 1;
    const text = pageText(p);
    for (const m of text.matchAll(run)) {
      if (m.index > 0 && /[\p{L}\p{N}]/u.test(text[m.index - 1])) continue;
      // The last character before the run that isn't a space or a tab (not a copy of the page so far).
      let back = m.index - 1;
      while (back >= 0 && (text[back] === " " || text[back] === "\t")) back--;
      const before = back < 0 ? "" : text[back];
      // Cut the run where a sentence ends inside it ("Jane. Elizabeth"): a full stop not after a title.
      const segments: { words: string[]; startsSentence: boolean }[] = [];
      let words: string[] = [];
      let startsSentence = before === "" || /[.!?:;"“”‘’(\n—-]/.test(before);
      for (const raw of m[0].split(/[ \t]+/)) {
        const endsSentence = raw.endsWith(".") && !isTitle(raw);
        // "Jane’s" is Jane.
        words.push((endsSentence ? raw.slice(0, -1) : raw).replace(/['’]s$/, ""));
        if (endsSentence) {
          segments.push({ words, startsSentence });
          words = [];
          startsSentence = true;
        }
      }
      if (words.length) segments.push({ words, startsSentence });
      for (const segment of segments) {
        let name = segment.words;
        // A first word that only starts the sentence ("The", "When") isn't part of the name.
        while (name.length > 0 && NOT_NAMES.has(name[0]) && !isTitle(name[0])) name = name.slice(1);
        // Not a title on its own, a single letter ("M.") or "I’ll".
        if (name.length === 0 || isTitle(name[name.length - 1]) || (name.length === 1 && (name[0].length < 2 || /^I['’]/.test(name[0])))) continue;
        const entry = note(name.join(" "), chapter);
        entry.count++;
        if (!segment.startsSentence || name.length < segment.words.length || name.length > 1) entry.inside++;
        // Each word of a longer name also counts towards that word on its own.
        if (name.length > 1) {
          for (const w of name) {
            if (isTitle(w) || NOT_NAMES.has(w) || w.length < 2 || /^I['’]/.test(w)) continue;
            const part = note(w, chapter);
            part.count++;
            part.inside++;
            part.inLonger++;
          }
        }
      }
    }
  }
  const recurring = [...seen.entries()].filter(([name, s]) => s.count >= LOCAL_MIN_MENTIONS && s.inside > 0 && !NOT_NAMES.has(name));
  // How often each is written in small letters, in one pass over the text so far.
  const small = [...new Set(recurring.map(([name]) => name.toLowerCase()))].filter((n) => n !== n.toUpperCase());
  if (small.length > 0) {
    const text = pages
      .filter((p) => p.chapterIndex <= chapterIndex)
      .map(pageText)
      .join("\n\n");
    const firsts = [...new Set(small.map((n) => n[0]))].map(escape).join("");
    const pattern = new RegExp(`(?=[${firsts}])(?<![\\p{L}\\p{N}])(?:${small.sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu");
    for (const m of text.matchAll(pattern)) lower.set(m[0], (lower.get(m[0]) ?? 0) + 1);
  }
  // Mostly written in small letters: an ordinary word that started sentences.
  const candidates = recurring.filter(([name, s]) => (lower.get(name.toLowerCase()) ?? 0) * 5 < s.count);
  return candidates
    .filter(([name, s]) => {
      if (name.includes(" ")) return true;
      // A word nearly always part of a longer listed name is left to that name.
      const longerListed = candidates.some(([other]) => other !== name && other.split(" ").includes(name));
      return !(longerListed && s.inLonger >= s.count * 0.8);
    })
    .sort((a, b) => b[1].count - a[1].count || a[1].firstChapter - b[1].firstChapter)
    .slice(0, LOCAL_MAX)
    .map(([name, s]) => ({ name, kind: "names" as const, description: null, firstChapter: s.firstChapter, aliases: [] }));
}

/** The demo's books with a sample X-Ray written ahead (data/demoXRay.ts). */
export type DemoXRay = Record<string, XRayItem[]>;

/**
 * How X-Ray works here. Books with only sample pages have nothing to look through. Uploads stay
 * on this device: names found here, never sent anywhere. Kids profiles get the same (X-Ray's
 * descriptions are written by an AI service, which isn't offered to them, like Who's who). The
 * demo uses its sample where it has one. Otherwise public-domain titles ask the `xray`
 * function with the backend, and fall back to names found here without it.
 */
export function xrayMode(input: {
  book: Pick<Book, "id" | "recording" | "upload">;
  profile: Pick<Profile, "ageRating"> | null;
  backend: boolean;
  demo: boolean;
  demoBooks: string[];
}): XRayMode {
  const { book, profile, backend, demo, demoBooks } = input;
  if (book.upload) return "local";
  if (!book.recording) return "none";
  if (profile?.ageRating === "kids") return "local";
  if (demo && demoBooks.includes(book.id)) return "demo";
  return backend ? "ai" : "local";
}

/** Whether the kinds tabs show: AI and demo X-Rays split people, places and terms; names found here are one list. */
export const kindsFor = (items: XRayItem[]): XRayKind[] => XRAY_KINDS.filter((k) => items.some((i) => i.kind === k));
