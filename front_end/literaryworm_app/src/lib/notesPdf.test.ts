import { describe, expect, it } from "@jest/globals";
import type { Highlight } from "../types";
import type { BookNotes } from "./exportNotes";
import { layoutPages, notesBlocks, notesPdf, pdfString, textWidth, wrap } from "./notesPdf";

const highlight = (over: Partial<Highlight>): Highlight => ({
  id: "h",
  bookId: "pride-and-prejudice",
  chapterIndex: 0,
  page: 0,
  start: 0,
  end: 10,
  quote: "It is a truth universally acknowledged.",
  color: "yellow",
  note: null,
  createdAt: 0,
  ...over,
});

const book: BookNotes = {
  title: "Pride and Prejudice",
  author: "Jane Austen",
  chapterTitles: ["Chapter 1", "Chapter 2"],
  highlights: [highlight({ id: "b", chapterIndex: 1, quote: "Second (chapter)", note: "Darcy’s pride" }), highlight({ id: "a" })],
  journal: [{ id: "j", bookId: "pride-and-prejudice", writtenOn: "2026-11-01", body: "Loved it.", createdAt: 0 } as never],
};

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("notes as a PDF", () => {
  it("writes a PDF whose cross-reference table points at each object", () => {
    const pdf = decode(notesPdf([book], "Pride and Prejudice notes", new Date("2026-11-07T12:00:00Z")));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(pdf.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    expect(pdf).toContain("/BaseFont /Times-Italic");
  });

  it("puts the book, its chapters in order, quotes, notes, the journal and the date", () => {
    const text = notesBlocks([book], new Date("2026-11-07T12:00:00Z")).map((b) => b.text);
    expect(text).toEqual([
      "Pride and Prejudice",
      "Jane Austen",
      "Chapter 1",
      "It is a truth universally acknowledged.",
      "Page 1 · Yellow",
      "Chapter 2",
      "Second (chapter)",
      "Page 1 · Yellow",
      "Note: Darcy’s pride",
      "Journal",
      "1 November 2026",
      "Loved it.",
      "Exported from LiteraryWorm on 7 November 2026.",
    ]);
  });

  it("escapes brackets, writes Windows-1252 letters as octal and others as ?", () => {
    expect(pdfString("a (b) \\ c")).toBe("(a \\(b\\) \\\\ c)");
    expect(pdfString("café “quote” — Ωμέγα")).toBe("(caf\\351 \\223quote\\224 \\227 ?????)");
  });

  it("wraps at the width, breaking a word only when it alone is too long", () => {
    const lines = wrap("word ".repeat(60).trim(), 12, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 12)).toBeLessThanOrEqual(200);
    const long = wrap("x".repeat(200), 12, 100);
    expect(long.every((l) => textWidth(l, 12) <= 100)).toBe(true);
    expect(long.join("")).toBe("x".repeat(200));
  });

  it("starts new pages for long notes, and handles empty input", () => {
    const many = { ...book, highlights: Array.from({ length: 80 }, (_, i) => highlight({ id: `h${i}`, page: i })) };
    expect(layoutPages(notesBlocks([many])).length).toBeGreaterThan(2);
    expect(wrap("", 12, 100)).toEqual([""]);
    expect(notesBlocks([]).map((b) => b.text)).toHaveLength(1);
    expect(decode(notesPdf([], "Empty"))).toContain("/Count 1");
  });
});
