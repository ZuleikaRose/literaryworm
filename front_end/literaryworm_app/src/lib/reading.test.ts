import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBook } from "../data/books";
import {
  PAGE_CHARS,
  chapterAt,
  chapterStarts,
  chapterTimes,
  formatTime,
  lostWithBook,
  pageForFraction,
  readerPages,
  spokenTime,
  textPages,
  today,
} from "./reading";

const bookText = (id: string): string[] => JSON.parse(readFileSync(`public/texts/${id}.json`, "utf8")).chapters;

describe("textPages", () => {
  it("fills pages with whole paragraphs up to about a page", () => {
    const para = "x".repeat(700);
    const pages = textPages([[para, para, para].join("\n\n")]);
    expect(pages.map((p) => p.paragraphs?.length)).toEqual([2, 1]);
    expect(pages.map((p) => p.page)).toEqual([0, 1]);
  });

  it("cuts a paragraph longer than a page between sentences", () => {
    const sentence = `${"word ".repeat(60).trim()}. `;
    const pages = textPages([sentence.repeat(10)]);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) for (const text of p.paragraphs ?? []) expect(text.length).toBeLessThanOrEqual(PAGE_CHARS);
  });

  it("keeps an empty chapter as one page", () => {
    expect(textPages(["", "Hello."])).toEqual([
      { chapterIndex: 0, page: 0, paragraphs: [""] },
      { chapterIndex: 1, page: 0, paragraphs: ["Hello."] },
    ]);
  });

  // Highlights store a page and character offsets, so the same text must always make the same pages.
  // If this fails, paging changed and members' saved highlights would land in the wrong place.
  it.each(["frankenstein", "pride-and-prejudice", "alice-in-wonderland"])("pages %s the same way every time", (id) => {
    const pages = textPages(bookText(id));
    const digest = createHash("sha256").update(JSON.stringify(pages)).digest("hex");
    expect({ pages: pages.length, digest }).toMatchSnapshot();
  });
});

describe("readerPages and chapterStarts", () => {
  it("gives every chapter 3 to 8 pages and finds each chapter's first page", () => {
    const book = getBook("dune")!;
    const pages = readerPages(book);
    const starts = chapterStarts(pages);
    expect(starts).toHaveLength(book.chapters.length);
    expect(starts[0]).toBe(0);
    for (let i = 0; i < book.chapters.length; i++) {
      const count = pages.filter((p) => p.chapterIndex === i).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(8);
      expect(pages[starts[i]]).toMatchObject({ chapterIndex: i, page: 0 });
    }
  });
});

describe("positions", () => {
  it("clamps a fraction to the book's pages", () => {
    expect(pageForFraction(-1, 10)).toBe(0);
    expect(pageForFraction(0.5, 10)).toBe(5);
    expect(pageForFraction(2, 10)).toBe(9);
  });

  it("finds the chapter playing at a time", () => {
    const book = getBook("frankenstein")!;
    const { starts, total } = chapterTimes(book);
    expect(starts[0]).toBe(0);
    expect(total).toBe(book.chapters.reduce((s, c) => s + c.minutes * 60, 0));
    expect(chapterAt(starts, 0)).toBe(0);
    expect(chapterAt(starts, starts[2])).toBe(2);
    expect(chapterAt(starts, starts[2] - 1)).toBe(1);
    expect(chapterAt(starts, total + 100)).toBe(starts.length - 1);
  });
});

describe("times", () => {
  it("writes clock and spoken times", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(-5)).toBe("0:00");
    expect(spokenTime(3725)).toBe("1 hour 2 minutes");
    expect(spokenTime(60)).toBe("1 minute");
    expect(spokenTime(7200)).toBe("2 hours");
    expect(spokenTime(10)).toBe("0 minutes");
  });

  it("gives today as a local YYYY-MM-DD", () => {
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("lostWithBook", () => {
  it("is null when nothing would be lost", () => {
    expect(lostWithBook(0, false, 0, 0)).toBeNull();
  });

  it("lists what removing a book deletes", () => {
    expect(lostWithBook(1, false, 0)).toBe("Your log will be deleted too. This can't be undone.");
    expect(lostWithBook(2, true, 3, 1)).toBe(
      "Your 2 logs, your place in the book, your 3 bookmarks and your highlight will be deleted too. This can't be undone.",
    );
  });
});
