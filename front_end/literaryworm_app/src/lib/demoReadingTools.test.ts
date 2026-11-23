import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { DEMO_DICTIONARY, DEMO_DICTIONARY_EXAMPLE } from "../data/demoDictionary";
import { getBook } from "../data/books";
import { demoHousehold } from "../store/state";
import { cleanWord, demoLookUp, DictionaryError, dictionaryCovers } from "./dictionaryApi";
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

describe("dictionaryCovers", () => {
  it("covers English books and books with no language given", () => {
    expect(dictionaryCovers("English")).toBe(true);
    expect(dictionaryCovers("en")).toBe(true);
    expect(dictionaryCovers("en-GB")).toBe(true);
    expect(dictionaryCovers(null)).toBe(true);
    expect(dictionaryCovers(undefined)).toBe(true);
  });

  it("doesn't cover books in other languages", () => {
    expect(dictionaryCovers("fr")).toBe(false);
    expect(dictionaryCovers("el")).toBe(false);
  });
});
