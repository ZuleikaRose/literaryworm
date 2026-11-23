import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { DEMO_XRAY, DEMO_XRAY_BOOKS } from "../data/demoXRay";
import { type ReaderPage, textPages } from "./reading";
import { countMentions, hasRealText, kindsFor, LOCAL_MAX, localNames, mentionIndex, mentionPattern, mentionStops, metBy, type XRayItem, xrayMode, xrayRows } from "./xray";
import { itemsFrom } from "./xrayApi";

const FIRST_CHAPTER = 0;
const SECOND_CHAPTER = 1;
const THIRD_CHAPTER = 2;
const NO_PROFILE = null;

/** Pages of real text: one array of paragraphs per page, with its chapter. */
const page = (chapterIndex: number, pageInChapter: number, ...paragraphs: string[]): ReaderPage => ({ chapterIndex, page: pageInChapter, paragraphs });

const PAGES: ReaderPage[] = [
  page(FIRST_CHAPTER, 0, "Mr. Bennet spoke to Mrs. Bennet of Netherfield.", "Jane smiled. Jane always smiled."),
  page(FIRST_CHAPTER, 1, "Netherfield is let at last, said Mrs. Bennet."),
  page(SECOND_CHAPTER, 0, "Elizabeth laughed at Mr. Bennet. Lizzy, he said, the entail is no joke."),
  page(THIRD_CHAPTER, 0, "Mr. Wickham arrived in Meryton. Elizabeth liked Mr. Wickham."),
];

const item = (name: string, kind: XRayItem["kind"], firstChapter: number, aliases: string[] = [], description: string | null = "Someone.") => ({
  name,
  kind,
  description,
  firstChapter,
  aliases,
});

const ITEMS: XRayItem[] = [
  item("Mrs. Bennet", "people", 1),
  item("Jane", "people", 1),
  item("Elizabeth", "people", 2, ["Lizzy"]),
  item("Mr. Wickham", "people", 3),
  item("Netherfield", "places", 1),
  item("entail", "terms", 2),
];

const bookText = (id: string): string[] => JSON.parse(readFileSync(`public/texts/${id}.json`, "utf8")).chapters;

describe("mentionPattern and countMentions", () => {
  it("count whole names only, case and all", () => {
    expect(countMentions("Jane and Janet met jane.", ["Jane"])).toBe(1);
    expect(countMentions("Mr. Darcy bowed; Mr Darcy left.", ["Mr. Darcy"])).toBe(1);
  });

  it("find a name split across a line break or several spaces", () => {
    expect(countMentions("at Netherfield\nPark and Netherfield   Park", ["Netherfield Park"])).toBe(2);
  });

  it("find a small-letter term at the start of a sentence too", () => {
    expect(countMentions("The entail. An entail. entailed.", ["entail"])).toBe(2);
  });

  it("count overlapping names once, the longest winning", () => {
    expect(countMentions("Mrs. Bennet and Bennet", ["Bennet", "Mrs. Bennet"])).toBe(2);
  });

  it("count nothing in empty text or for empty names", () => {
    expect(countMentions("", ["Jane"])).toBe(0);
    expect(countMentions("Jane", [])).toBe(0);
    expect(countMentions("Jane", ["  "])).toBe(0);
  });

  it("work for letters outside English", () => {
    expect(countMentions("Ο Δελφός και η Ἀθῆναι.", ["Ἀθῆναι"])).toBe(1);
    expect(mentionPattern("Ἀθῆναι").flags).toContain("u");
  });
});

describe("the spoiler cut", () => {
  it("keeps only what's met by the reader's chapter", () => {
    expect(metBy(ITEMS, FIRST_CHAPTER).map((i) => i.name)).toEqual(["Mrs. Bennet", "Jane", "Netherfield"]);
    expect(metBy(ITEMS, SECOND_CHAPTER).map((i) => i.name)).not.toContain("Mr. Wickham");
  });

  it("drops entries with no chapter or a chapter before the first", () => {
    expect(metBy([item("Nobody", "people", 0)], THIRD_CHAPTER)).toEqual([]);
  });

  it("never lists anything first named after the reader's chapter, even if the source says earlier", () => {
    const early = [item("Mr. Wickham", "people", 1)];
    const rows = xrayRows(early, PAGES, SECOND_CHAPTER, "sofar");
    expect(rows).toEqual([expect.objectContaining({ name: "Mr. Wickham", total: 0 })]);
    // With no description (names found here), a name the text hasn't reached isn't shown at all.
    expect(xrayRows([item("Mr. Wickham", "names", 1, [], null)], PAGES, SECOND_CHAPTER, "sofar")).toEqual([]);
  });

  it("keeps the server's answer to the reader's chapter too", () => {
    const body = { people: [{ name: "Jane", description: "Eldest.", firstChapter: 1 }, { name: "Mr. Wickham", description: "Later.", firstChapter: 3 }], places: "nope" };
    expect(itemsFrom(body, SECOND_CHAPTER).map((i) => i.name)).toEqual(["Jane"]);
    expect(itemsFrom(null, SECOND_CHAPTER)).toEqual([]);
  });

  it("drops an alias that holds another entry's name, so mentions aren't counted twice", () => {
    const body = {
      people: [
        { name: "Mrs. Bennet", description: "His wife.", firstChapter: 1, aliases: ["my dear Mr. Bennet", "Mama"] },
        { name: "Mr. Bennet", description: "Her husband.", firstChapter: 1, aliases: [] },
      ],
    };
    expect(itemsFrom(body, FIRST_CHAPTER).find((i) => i.name === "Mrs. Bennet")!.aliases).toEqual(["Mama"]);
  });
});

describe("xrayRows: mentions and filters", () => {
  it("counts the book so far, up to and including the reader's chapter", () => {
    const rows = xrayRows(ITEMS, PAGES, SECOND_CHAPTER, "sofar");
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Mrs. Bennet"].total).toBe(2);
    expect(byName["Jane"].total).toBe(2);
    expect(byName["Netherfield"].total).toBe(2);
    expect(byName["Elizabeth"].total).toBe(2);
    expect(byName["Elizabeth"].pages).toEqual([{ index: 2, chapterIndex: SECOND_CHAPTER, page: 0, count: 2 }]);
    expect(byName["Mr. Wickham"]).toBeUndefined();
  });

  it("lists only what this chapter names in 'This chapter'", () => {
    const rows = xrayRows(ITEMS, PAGES, SECOND_CHAPTER, "chapter");
    expect(rows.map((r) => r.name).sort()).toEqual(["Elizabeth", "entail"]);
  });

  it("puts the most mentioned first", () => {
    const rows = xrayRows(ITEMS.filter((i) => i.kind === "people"), PAGES, FIRST_CHAPTER, "sofar");
    expect(rows[0].total).toBeGreaterThanOrEqual(rows[rows.length - 1].total);
  });

  it("takes when it was first met from the text", () => {
    const rows = xrayRows([item("Netherfield", "places", 2)], PAGES, SECOND_CHAPTER, "sofar");
    expect(rows[0].firstMet).toBe(1);
  });

  it("gives nothing for no items or no pages", () => {
    expect(xrayRows([], PAGES, SECOND_CHAPTER, "sofar")).toEqual([]);
    expect(xrayRows(ITEMS, [], SECOND_CHAPTER, "chapter")).toEqual([]);
  });
});

describe("mentionStops", () => {
  it("has a stop for every chapter so far, going to the first mention in each", () => {
    const [jane] = xrayRows([item("Jane", "people", 1)], PAGES, SECOND_CHAPTER, "sofar");
    expect(mentionStops(jane, PAGES, SECOND_CHAPTER, "sofar")).toEqual([
      { at: 0, count: 2, index: 0 },
      { at: 1, count: 0, index: null },
    ]);
  });

  it("has a stop for every page of the chapter in 'This chapter'", () => {
    const [netherfield] = xrayRows([item("Netherfield", "places", 1)], PAGES, FIRST_CHAPTER, "chapter");
    expect(mentionStops(netherfield, PAGES, FIRST_CHAPTER, "chapter")).toEqual([
      { at: 0, count: 1, index: 0 },
      { at: 1, count: 1, index: 1 },
    ]);
  });
});

describe("localNames: names found on this device", () => {
  it("finds recurring names in the text up to the chapter, with titles kept", () => {
    const names = localNames(textPages(bookText("pride-and-prejudice")), 4).map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["Mr. Bennet", "Mrs. Bennet", "Jane", "Elizabeth", "Netherfield", "Meryton"]));
    expect(names).not.toContain("Mr. Collins");
    expect(names).not.toContain("The");
    expect(names).not.toContain("Mr.");
  });

  it("leaves out contractions, single letters and ordinary words that only start sentences", () => {
    const names = localNames(textPages(bookText("alice-in-wonderland")), 11).map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["Alice", "White Rabbit", "Mock Turtle", "Gryphon"]));
    for (const word of ["I’m", "I’ll", "There", "So", "Oh", "M"]) expect(names).not.toContain(word);
  });

  it("keeps at most LOCAL_MAX names, all without descriptions", () => {
    const names = localNames(textPages(bookText("pride-and-prejudice")), 60);
    expect(names.length).toBeLessThanOrEqual(LOCAL_MAX);
    expect(names.every((n) => n.description === null && n.kind === "names")).toBe(true);
  });

  it("finds nothing in empty pages or sample pages", () => {
    expect(localNames([], 3)).toEqual([]);
    expect(localNames([{ chapterIndex: 0, page: 0 }], 0)).toEqual([]);
  });

  it("finds names in Greek too", () => {
    const pages = [page(0, 0, "Ο Αλέξης είπε. Ο Αλέξης γέλασε, και ο Αλέξης έφυγε.")];
    expect(localNames(pages, 0).map((n) => n.name)).toContain("Αλέξης");
  });
});

describe("xrayMode: who gets which X-Ray", () => {
  const classic = { id: "frankenstein", recording: { title: "x" } as never, upload: undefined };
  const upload = { id: "u-0123", recording: undefined, upload: { path: null } };
  const sampleOnly = { id: "dune", recording: undefined, upload: undefined };
  const demoBooks = DEMO_XRAY_BOOKS;
  const grownUp = { ageRating: "all" as const };
  const teen = { ageRating: "teen" as const };
  const kids = { ageRating: "kids" as const };

  it("gives members' grown-up and teen profiles the AI X-Ray for classics", () => {
    expect(xrayMode({ book: classic, profile: grownUp, backend: true, demo: false, demoBooks })).toBe("ai");
    expect(xrayMode({ book: classic, profile: teen, backend: true, demo: false, demoBooks })).toBe("ai");
  });

  it("never sends Kids profiles to the AI service: names found on the device instead", () => {
    expect(xrayMode({ book: classic, profile: kids, backend: true, demo: false, demoBooks })).toBe("local");
    expect(xrayMode({ book: classic, profile: kids, backend: false, demo: true, demoBooks })).toBe("local");
  });

  it("keeps uploads on the device, whoever reads them", () => {
    for (const profile of [grownUp, teen, kids, NO_PROFILE]) expect(xrayMode({ book: upload, profile, backend: true, demo: false, demoBooks })).toBe("local");
  });

  it("says there's nothing to look through for books with sample pages only", () => {
    expect(xrayMode({ book: sampleOnly, profile: grownUp, backend: true, demo: false, demoBooks })).toBe("none");
  });

  it("uses the demo's sample in the demo, and names found here for its other classics without a backend", () => {
    expect(xrayMode({ book: classic, profile: grownUp, backend: false, demo: true, demoBooks })).toBe("demo");
    expect(xrayMode({ book: { ...classic, id: "dracula" }, profile: grownUp, backend: false, demo: true, demoBooks })).toBe("local");
    expect(xrayMode({ book: { ...classic, id: "dracula" }, profile: grownUp, backend: true, demo: true, demoBooks })).toBe("ai");
  });
});

describe("the demo's sample X-Ray", () => {
  it("covers the demo's three classics with text", () => {
    expect(DEMO_XRAY_BOOKS.sort()).toEqual(["alice-in-wonderland", "frankenstein", "pride-and-prejudice"]);
  });

  it.each(DEMO_XRAY_BOOKS)("%s: every entry is first named in the chapter it says, with every alias in the text", (id) => {
    const chapters = bookText(id);
    for (const entry of DEMO_XRAY[id]) {
      const first = chapters.findIndex((text) => [entry.name, ...entry.aliases].some((n) => countMentions(text, [n]) > 0));
      expect({ name: entry.name, firstChapter: first + 1 }).toEqual({ name: entry.name, firstChapter: entry.firstChapter });
      for (const alias of entry.aliases) expect({ alias, found: chapters.some((text) => countMentions(text, [alias]) > 0) }).toEqual({ alias, found: true });
    }
  });

  it.each(DEMO_XRAY_BOOKS)("%s: has people, places and terms, each with a description", (id) => {
    expect(kindsFor(DEMO_XRAY[id])).toEqual(["people", "places", "terms"]);
    expect(DEMO_XRAY[id].every((e) => (e.description ?? "").length > 0)).toBe(true);
  });

  it("shows something on the first page of each demo book", () => {
    for (const id of DEMO_XRAY_BOOKS) {
      const pages = textPages(bookText(id));
      expect(hasRealText(pages)).toBe(true);
      expect(xrayRows(DEMO_XRAY[id], pages, FIRST_CHAPTER, "sofar").length).toBeGreaterThan(0);
    }
  });
});

describe("a very long book", () => {
  /** About 2.7 million characters: Pride and Prejudice four times over, as the reader's pages. */
  const BOOK_CHARS = 2_700_000;
  /** As many entries and names as the function can send: 40 + 25 + 25, each with 4 aliases. */
  const ENTRIES = 90;
  /** The budget for counting every mention once, generous for slow test machines (it takes about 50 ms). */
  const BUDGET_MS = 400;
  const chapters = bookText("pride-and-prejudice");
  const many: string[] = [];
  while (many.join("").length < BOOK_CHARS) many.push(...chapters);
  const pages = textPages(many);
  const last = many.length - 1;
  const NAMES = ["Elizabeth", "Jane", "Mr. Bennet", "Mrs. Bennet", "Mr. Darcy", "Mr. Bingley", "Netherfield", "Longbourn", "Meryton", "Pemberley", "Wickham", "Lady Catherine", "Charlotte", "Lydia", "Kitty", "entail", "militia", "London"];
  const entries: XRayItem[] = Array.from({ length: ENTRIES }, (_, i) =>
    item(i < NAMES.length ? NAMES[i] : `Nobody${i}`, i % 3 === 0 ? "people" : i % 3 === 1 ? "places" : "terms", 1, [`Alias${i}a`, `Alias${i}b`, `Alias${i}c`, `Alias${i}d`]),
  );

  it("counts every entry's mentions in one pass, within the budget", () => {
    const started = performance.now();
    const index = mentionIndex(entries, pages, last);
    const sofar = xrayRows(entries, pages, last, "sofar", index);
    xrayRows(entries, pages, last, "chapter", index);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
    expect(sofar.find((r) => r.name === "Elizabeth")!.total).toBeGreaterThan(2000);
  });

  it("gives the same counts as counting each entry on its own", () => {
    const index = mentionIndex(entries.slice(0, 3), pages, 2);
    for (const [i, entry] of entries.slice(0, 3).entries()) {
      const one = pages.filter((p) => p.chapterIndex <= 2).reduce((n, p) => n + countMentions(p.paragraphs!.join("\n"), [entry.name, ...entry.aliases]), 0);
      expect([...index[i].values()].reduce((n, c) => n + c, 0)).toBe(one);
    }
  });

  it("finds names on the device within the budget too", () => {
    const started = performance.now();
    expect(localNames(pages, last).length).toBeGreaterThan(0);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS * 5);
  });
});
