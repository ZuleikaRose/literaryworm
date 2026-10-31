import { describe, expect, it } from "@jest/globals";
import type { SavedWord } from "../types";
import { CONTEXT_MAX, firstDefinition, hasWord, practiceDeck, sentenceAround, wordsSummary } from "./words";

const word = (w: string, createdAt: number, learned = false): SavedWord => ({
  word: w,
  definition: null,
  bookId: null,
  chapterIndex: null,
  page: null,
  context: null,
  learned,
  createdAt,
});

describe("sentenceAround", () => {
  const text = "It was a dark night. The wind was melancholy and wild! Nobody came.\nA new paragraph here";

  it("finds the sentence holding the word", () => {
    const start = text.indexOf("melancholy");
    expect(sentenceAround(text, start, start + 10)).toBe("The wind was melancholy and wild!");
  });

  it("stops at a paragraph break", () => {
    const start = text.indexOf("paragraph");
    expect(sentenceAround(text, start, start + 9)).toBe("A new paragraph here");
  });

  it("refuses a range outside the text", () => {
    expect(sentenceAround(text, 5, 500)).toBeNull();
    expect(sentenceAround(text, 4, 4)).toBeNull();
  });

  it("clips a very long sentence", () => {
    const long = "word ".repeat(200);
    expect(sentenceAround(long, 0, 4)!.length).toBeLessThanOrEqual(CONTEXT_MAX);
  });
});

describe("firstDefinition", () => {
  it("joins the part of speech and the first sense", () => {
    expect(
      firstDefinition({
        word: "wan",
        phonetic: null,
        sourceUrl: null,
        meanings: [{ partOfSpeech: "adjective", definitions: [{ definition: "Pale and sickly.", example: null }] }],
      }),
    ).toBe("adjective: Pale and sickly.");
  });

  it("is null without a sense", () => {
    expect(firstDefinition({ word: "x", phonetic: null, sourceUrl: null, meanings: [] })).toBeNull();
  });
});

describe("practiceDeck and summary", () => {
  const words = [word("c", 3, true), word("a", 1), word("b", 2)];

  it("puts words not yet known first, oldest first", () => {
    expect(practiceDeck(words).map((w) => w.word)).toEqual(["a", "b", "c"]);
  });

  it("counts the known ones", () => {
    expect(wordsSummary(words)).toBe("3 words, 1 known");
    expect(wordsSummary([word("a", 1)])).toBe("1 word");
    expect(hasWord(words, "b")).toBe(true);
  });
});
