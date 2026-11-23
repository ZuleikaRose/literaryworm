import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { DEMO_DICTIONARY, DEMO_DICTIONARY_EXAMPLE } from "../data/demoDictionary";
import { getBook } from "../data/books";
import { demoHousehold } from "../store/state";
import { cleanWord, demoLookUp, DictionaryError, dictionaryLanguage, DICTIONARY_LANGUAGES, lookUpWord } from "./dictionaryApi";
import { hasWord } from "./words";
import type { SavedWord } from "../types";
import { type BookNotes, exportNotes } from "./exportNotes";
import { notesPdf } from "./notesPdf";
import { textPages } from "./reading";

/**
 * The demo's reading tools: every profile has notes to export, the highlights sit on their real
 * words, and the offline dictionary answers for words on the demo books' pages.
 */

const PDF_HEADER = "%PDF-";
const UNKNOWN_WORD = "zyzzyva";
const household = demoHousehold();

/** A profile's notes as My Library → Notes gathers them (lib/useNotesBooks.ts), for catalog books. */
function notesFor(profileId: string): BookNotes[] {
  const data = household.profileData[profileId];
  const ids = new Set([...data.highlights.map((h) => h.bookId), ...data.journal.map((e) => e.bookId)]);
  return [...ids].map((id) => {
    const book = getBook(id);
    return {
      title: book?.title ?? "Untitled book",
      author: book?.author ?? null,
      chapterTitles: book?.chapters.map((c) => c.title) ?? [],
      highlights: data.highlights.filter((h) => h.bookId === id),
      journal: data.journal.filter((e) => e.bookId === id),
    };
  });
}

describe("the demo's notes", () => {
  it.each(household.profiles.map((p) => [p.name, p.id]))("%s has highlights to export, in Markdown, text and PDF", (_name, id) => {
    const books = notesFor(id);
    expect(books.length).toBeGreaterThan(0);
    const markdown = exportNotes(books, "markdown");
    const text = exportNotes(books, "text");
    for (const h of books.flatMap((b) => b.highlights)) {
      expect(markdown).toContain(h.quote.split("\n")[0]);
      expect(text).toContain(h.quote);
    }
    expect(new TextDecoder().decode(notesPdf(books, "Notes").slice(0, PDF_HEADER.length))).toBe(PDF_HEADER);
  });

  it("includes a Kids profile's journal entry in its export", () => {
    const mia = household.profiles.find((p) => p.ageRating === "kids")!;
    const entry = household.profileData[mia.id].journal[0];
    expect(exportNotes(notesFor(mia.id), "markdown")).toContain(entry.body);
  });

  it("puts every highlight on its real words in the book's text", () => {
    for (const profile of household.profiles) {
      for (const h of household.profileData[profile.id].highlights) {
        const chapters: string[] = JSON.parse(readFileSync(`public/texts/${h.bookId}.json`, "utf8")).chapters;
        const page = textPages(chapters).find((p) => p.chapterIndex === h.chapterIndex && p.page === h.page)!;
        expect(page.paragraphs!.join("\n").slice(h.start, h.end)).toBe(h.quote);
      }
    }
  });
});

describe("the demo's offline dictionary", () => {
  it("answers for its own words, credited to the demo", async () => {
    const entry = await demoLookUp(DEMO_DICTIONARY_EXAMPLE);
    expect(entry.demo).toBe(true);
    expect(entry.meanings[0].definitions[0].definition.length).toBeGreaterThan(0);
  });

  it("has every word the demo's My words keeps", () => {
    for (const data of Object.values(household.profileData)) for (const w of data.words) expect(Object.hasOwn(DEMO_DICTIONARY, w.word)).toBe(true);
  });

  it("keeps each word the way the dictionary cleans it", () => {
    for (const [word, entry] of Object.entries(DEMO_DICTIONARY)) {
      expect(cleanWord(word)).toBe(word);
      expect(entry.word).toBe(word);
      expect(entry.meanings.length).toBeGreaterThan(0);
    }
  });

  it("has a word from the first page of each demo book", () => {
    for (const id of ["pride-and-prejudice", "frankenstein", "alice-in-wonderland"]) {
      const first = textPages(JSON.parse(readFileSync(`public/texts/${id}.json`, "utf8")).chapters)[0].paragraphs!.join(" ").toLowerCase();
      const words = first.match(/\p{L}+/gu) ?? [];
      expect(words.some((w) => Object.hasOwn(DEMO_DICTIONARY, w))).toBe(true);
    }
  });

  it("says plainly when it lacks a word, naming one it has", async () => {
    await expect(demoLookUp(UNKNOWN_WORD)).rejects.toThrow(DEMO_DICTIONARY_EXAMPLE);
    await expect(demoLookUp(UNKNOWN_WORD)).rejects.toBeInstanceOf(DictionaryError);
  });

  it("passes on the function's own error when it has no entry either", async () => {
    const original = new DictionaryError("upstream_error", "The dictionary isn't answering right now. Try again in a moment.");
    await expect(demoLookUp(UNKNOWN_WORD, original)).rejects.toBe(original);
  });
});

describe("dictionaryLanguage: the book's own language", () => {
  it("looks English books, and books with no language given, up in English", () => {
    expect(dictionaryLanguage("English")).toBe("en");
    expect(dictionaryLanguage("en-GB")).toBe("en");
    expect(dictionaryLanguage(null)).toBe("en");
    expect(dictionaryLanguage(undefined)).toBe("en");
  });

  it("looks the site's other languages up in theirs, by code or name", () => {
    expect(dictionaryLanguage("fr")).toBe("fr");
    expect(dictionaryLanguage("de-AT")).toBe("de");
    expect(dictionaryLanguage("el")).toBe("el");
    expect(DICTIONARY_LANGUAGES).toHaveLength(21);
  });

  it("says when a book's language isn't one it has", () => {
    expect(dictionaryLanguage("la")).toBeNull();
    expect(dictionaryLanguage("eo")).toBeNull();
  });
});

describe("cleanWord per language", () => {
  it("keeps English to lower-case a–z", () => {
    expect(cleanWord(" Don’t ")).toBe("don't");
    expect(cleanWord("Rock’n’roll")).toBe("rock'n'roll");
    expect(cleanWord("σπίτι")).toBeNull();
  });

  it("takes any letters, case kept, in other languages", () => {
    expect(cleanWord("Haus", "de")).toBe("Haus");
    expect(cleanWord("σπίτι", "el")).toBe("σπίτι");
    expect(cleanWord("घर", "hi")).toBe("घर");
    expect(cleanWord("aujourd’hui", "fr")).toBe("aujourd'hui");
    expect(cleanWord("two words", "fr")).toBeNull();
    expect(cleanWord("x1", "fr")).toBeNull();
    expect(cleanWord("", "fr")).toBeNull();
    expect(cleanWord("a".repeat(41), "fr")).toBeNull();
  });

  it("gives one composed (NFC) spelling, however the accent was typed", () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(composed).not.toBe(decomposed);
    expect(cleanWord(decomposed, "fr")).toBe(composed);
    expect(cleanWord(composed, "fr")).toBe(composed);
    expect(cleanWord(decomposed, "fr")!.length).toBe(composed.length);
  });
});

describe("the demo dictionary in other languages", () => {
  it("says plainly that its offline words are English only", async () => {
    await expect(lookUpWord("maison", { demo: true, lang: "fr" })).rejects.toThrow("English words only");
  });
});

describe("My words per language", () => {
  const word = (w: string, language?: string): SavedWord => ({ word: w, language, definition: null, bookId: null, chapterIndex: null, page: null, context: null, learned: false, reviewDue: null, reviewStep: 0, createdAt: 0 });

  it("keeps the same spelling once per language, English when none is given", () => {
    const words = [word("gift"), word("Gift", "de")];
    expect(hasWord(words, "gift")).toBe(true);
    expect(hasWord(words, "gift", "en")).toBe(true);
    expect(hasWord(words, "Gift", "de")).toBe(true);
    expect(hasWord(words, "gift", "de")).toBe(false);
    expect(hasWord([], "gift")).toBe(false);
  });
});
