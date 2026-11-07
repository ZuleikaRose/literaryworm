import { describe, expect, it } from "@jest/globals";
import { nthWord, pageWordCount, placeOfWord, shareOfWord, spokenWordIndex } from "./readAlong";

const chapter = "One two three.\n\nFour  five six.";

describe("read-along in the reader", () => {
  it("finds the word being spoken by its share of the chapter's letters", () => {
    // "One two three. Four five six." is 29 letters long.
    expect(spokenWordIndex(chapter, 0)).toBe(0);
    expect(spokenWordIndex(chapter, 0.5)).toBe(3);
    expect(spokenWordIndex(chapter, 1)).toBe(5);
    expect(spokenWordIndex("", 0.5)).toBe(-1);
  });

  it("starts the voice at a word", () => {
    expect(shareOfWord(chapter, 0)).toBe(0);
    expect(shareOfWord(chapter, 3)).toBeCloseTo(15 / 29);
    expect(spokenWordIndex(chapter, shareOfWord(chapter, 4))).toBe(4);
    expect(shareOfWord("", 2)).toBe(0);
  });

  it("places a word on a page by counting words, whatever the page breaks", () => {
    expect(placeOfWord([3, 3], 0)).toEqual({ page: 0, word: 0 });
    expect(placeOfWord([3, 3], 4)).toEqual({ page: 1, word: 1 });
    expect(placeOfWord([3, 3], 6)).toBeNull();
    expect(placeOfWord([3], -1)).toBeNull();
    const page = "Four five\nsix.";
    expect(pageWordCount(page)).toBe(3);
    expect(nthWord(page, 2)).toEqual({ start: 10, end: 14 });
    expect(nthWord(page, 3)).toBeNull();
  });
});
