import { describe, expect, it } from "vitest";
import type { Highlight } from "../types";
import { highlightPlace, paragraphOffsets, paragraphSegments, singleWord } from "./highlights";

const highlight = (start: number, end: number, createdAt: number): Highlight => ({
  id: `h${createdAt}`,
  bookId: "dune",
  chapterIndex: 0,
  page: 0,
  start,
  end,
  quote: "",
  color: "yellow",
  note: null,
  createdAt,
});

describe("paragraphOffsets", () => {
  it("counts the line break between paragraphs", () => {
    expect(paragraphOffsets(["abc", "de", "f"])).toEqual([0, 4, 7]);
  });

  it("has nothing for a page without paragraphs", () => {
    expect(paragraphOffsets([])).toEqual([]);
  });
});

describe("paragraphSegments", () => {
  it("returns the whole paragraph when nothing is highlighted", () => {
    expect(paragraphSegments("Hello world", 0, [])).toEqual([{ text: "Hello world", highlight: null }]);
  });

  it("splits around a highlight, using the paragraph's offset in the page", () => {
    // The paragraph starts at 10 in the page's text, so "world" is 16 to 21.
    const h = highlight(16, 21, 1);
    expect(paragraphSegments("Hello world!", 10, [h])).toEqual([
      { text: "Hello ", highlight: null },
      { text: "world", highlight: h },
      { text: "!", highlight: null },
    ]);
  });

  it("shows the newest highlight where two overlap", () => {
    const segments = paragraphSegments("abcdefghijk", 0, [highlight(0, 8, 1), highlight(4, 11, 2)]);
    expect(segments.map((s) => [s.text, s.highlight?.id ?? null])).toEqual([
      ["abcd", "h1"],
      ["efghijk", "h2"],
    ]);
  });

  it("clips a highlight that runs into the next paragraph", () => {
    expect(paragraphSegments("abcde", 0, [highlight(2, 50, 1)]).map((s) => s.text)).toEqual(["ab", "cde"]);
  });

  it("ignores highlights on other paragraphs, including ones ending exactly where it starts", () => {
    expect(paragraphSegments("abc", 10, [highlight(0, 5, 1)])).toEqual([{ text: "abc", highlight: null }]);
    expect(paragraphSegments("abc", 10, [highlight(5, 10, 1), highlight(13, 20, 2)])).toEqual([{ text: "abc", highlight: null }]);
  });

  it("covers the whole paragraph when a highlight matches its edges", () => {
    const h = highlight(10, 13, 1);
    expect(paragraphSegments("abc", 10, [h])).toEqual([{ text: "abc", highlight: h }]);
  });

  it("leaves an empty paragraph alone", () => {
    expect(paragraphSegments("", 0, [highlight(0, 5, 1)])).toEqual([{ text: "", highlight: null }]);
  });
});

describe("singleWord", () => {
  it("accepts one word, trimming punctuation", () => {
    expect(singleWord(" “Whale,” ")).toBe("Whale");
    expect(singleWord("well-known")).toBe("well-known");
    expect(singleWord("don’t")).toBe("don’t");
  });

  it("refuses more than one word", () => {
    expect(singleWord("two words")).toBeNull();
    expect(singleWord("123")).toBeNull();
  });

  it("refuses an empty selection and a word over 40 letters", () => {
    expect(singleWord("")).toBeNull();
    expect(singleWord("   ")).toBeNull();
    expect(singleWord("a".repeat(40))).toBe("a".repeat(40));
    expect(singleWord("a".repeat(41))).toBeNull();
  });
});

it("names a highlight's place counting from 1", () => {
  expect(highlightPlace({ chapterIndex: 2, page: 1 })).toBe("Chapter 3, page 2");
});
