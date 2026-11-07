import { describe, expect, it } from "@jest/globals";
import { PDF_PAGES_PER_PART, pageParagraphs, pdfChapters, runningLines } from "./pdfText";

const part = (from: number, to: number) => `Pages ${from}–${to}`;

describe("a PDF's text as a book", () => {
  it("joins lines into paragraphs, ending one where a sentence ends on a short line", () => {
    const lines = [
      "It was a bright cold day in April, and the clocks were",
      "striking thirteen. Winston Smith hurried home.",
      "The hallway smelt of boiled cabbage and old rag mats, and",
      "at one end of it a coloured poster had been tacked to the wall.",
    ];
    expect(pageParagraphs(lines)).toEqual([
      "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith hurried home.",
      "The hallway smelt of boiled cabbage and old rag mats, and at one end of it a coloured poster had been tacked to the wall.",
    ]);
  });

  it("joins words hyphenated across lines, and drops page numbers", () => {
    expect(pageParagraphs(["The great exam-", "ination began at nine.", "42", "Page 7 of 300"])).toEqual(["The great examination began at nine."]);
    // A capital after the hyphen is a real hyphen (a name), so it stays.
    expect(pageParagraphs(["Jean-", "Paul arrived."])).toEqual(["Jean- Paul arrived."]);
  });

  it("drops running heads that repeat on most pages, whatever their page number", () => {
    const body = ["Morning came slowly over the hills.", "Nobody spoke at breakfast that day.", "The letter arrived after lunch.", "She read it twice by the window.", "Then she packed a small bag."];
    const pages = body.map((text, i) => ["THE BOOK OF DAYS", text, `Chapter One · ${i + 1}`]);
    const skip = runningLines(pages);
    expect(pageParagraphs(pages[2], skip)).toEqual(["The letter arrived after lunch."]);
    // Too few pages to tell a running head from text.
    expect(runningLines(pages.slice(0, 3)).size).toBe(0);
  });

  it("splits parts at the PDF's bookmarks, in page order, the pages before the first joining it", () => {
    const pages = [["Title page."], ["Contents."], ["Call me Ishmael."], ["More of one."], ["Loomings, two."]];
    const chapters = pdfChapters(pages, [{ title: "Two", page: 4 }, { title: "One", page: 2 }, { title: "Nowhere", page: 99 }], part);
    expect(chapters).toEqual([
      { title: "One", text: "Title page.\n\nContents.\n\nCall me Ishmael.\n\nMore of one." },
      { title: "Two", text: "Loomings, two." },
    ]);
  });

  it("without usable bookmarks, splits into runs of pages", () => {
    const pages = Array.from({ length: PDF_PAGES_PER_PART + 3 }, (_, i) => [`Page text ${i + 1}.`]);
    const chapters = pdfChapters(pages, [{ title: "Only one", page: 0 }], part);
    expect(chapters.map((c) => c.title)).toEqual([`Pages 1–${PDF_PAGES_PER_PART}`, `Pages ${PDF_PAGES_PER_PART + 1}–${PDF_PAGES_PER_PART + 3}`]);
  });

  it("handles empty input: no lines, no pages, empty pages", () => {
    expect(pageParagraphs([])).toEqual([]);
    expect(pageParagraphs(["", "   ", "12"])).toEqual([]);
    expect(pdfChapters([], [], part)).toEqual([]);
    expect(pdfChapters([[], []], [], part)).toEqual([]);
    expect(runningLines([]).size).toBe(0);
  });
});
