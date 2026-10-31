import { describe, expect, it } from "@jest/globals";
import type { Highlight } from "../types";
import { exportFileName, exportNotes, type BookNotes } from "./exportNotes";

const h = (over: Partial<Highlight>): Highlight => ({
  id: "h",
  bookId: "b",
  chapterIndex: 0,
  page: 0,
  start: 0,
  end: 5,
  quote: "Quote",
  color: "yellow",
  note: null,
  createdAt: 0,
  ...over,
});

const book: BookNotes = {
  title: "Pride and Prejudice",
  author: "Jane Austen",
  chapterTitles: ["Chapter I", "Chapter II"],
  highlights: [
    h({ id: "2", chapterIndex: 1, page: 2, quote: "Second", color: "teal", note: "Lovely." }),
    h({ id: "1", chapterIndex: 0, page: 0, quote: "It is a truth universally acknowledged" }),
  ],
};
const day = new Date("2026-10-31T12:00:00Z");

describe("exportNotes", () => {
  it("writes one book as Markdown, in reading order", () => {
    const md = exportNotes([book], "markdown", day);
    expect(md).toContain("# Pride and Prejudice\n\n*Jane Austen*");
    expect(md.indexOf("Chapter I\n")).toBeLessThan(md.indexOf("Chapter II"));
    expect(md).toContain("> It is a truth universally acknowledged");
    expect(md).toContain("Page 3 · Teal");
    expect(md).toContain("**Note:** Lovely.");
    expect(md).toContain("Exported from LiteraryWorm on 31 October 2026.");
  });

  it("puts several books under one heading and skips books without highlights", () => {
    const md = exportNotes([book, { ...book, title: "Empty", highlights: [] }, { ...book, title: "Emma" }], "markdown", day);
    expect(md.startsWith("# My notes and highlights")).toBe(true);
    expect(md).toContain("## Pride and Prejudice");
    expect(md).toContain("## Emma");
    expect(md).not.toContain("Empty");
  });

  it("writes plain text", () => {
    const text = exportNotes([book], "text", day);
    expect(text).toContain("Pride and Prejudice by Jane Austen\n=");
    expect(text).toContain('"Second"\n(page 3, teal)\nNote: Lovely.');
  });
});

describe("exportNotes edge cases", () => {
  it("gives only the heading and the date with no books", () => {
    expect(exportNotes([], "markdown", day)).toBe("# My notes and highlights\n\nExported from LiteraryWorm on 31 October 2026.\n\n\n");
    expect(exportNotes([], "text", day)).toBe("\n\nExported from LiteraryWorm on 31 October 2026.\n");
  });

  it("leaves out the note line when a highlight has no note", () => {
    const md = exportNotes([{ ...book, highlights: [h({ quote: "Plain", note: null })] }], "markdown", day);
    expect(md).toContain("> Plain\n\nPage 1 · Yellow\n\n---");
    expect(md).not.toContain("**Note:**");
  });

  it("names an unknown chapter by its number and leaves out a missing author", () => {
    const md = exportNotes([{ title: "Upload", author: null, chapterTitles: [], highlights: [h({ chapterIndex: 4 })] }], "markdown", day);
    expect(md).toContain("# Upload\n\n## Chapter 5");
    expect(md).not.toContain("*null*");
  });
});

describe("exportFileName", () => {
  it("makes a safe name", () => {
    expect(exportFileName("Pride & Prejudice!", "markdown")).toBe("pride-prejudice-notes.md");
    expect(exportFileName("???", "text")).toBe("notes-notes.txt");
  });

  it("falls back to notes for an empty or blank title", () => {
    expect(exportFileName("", "markdown")).toBe("notes-notes.md");
    expect(exportFileName("   ", "text")).toBe("notes-notes.txt");
  });
});
