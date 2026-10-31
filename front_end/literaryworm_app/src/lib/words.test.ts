import { describe, expect, it } from "@jest/globals";
import type { SavedWord } from "../types";
import { CONTEXT_MAX, dueLabel, dueWords, firstDefinition, hasWord, nextReview, practiceDeck, REVIEW_INTERVALS, sentenceAround, wordsSummary } from "./words";

const word = (w: string, createdAt: number, learned = false): SavedWord => ({
  word: w,
  definition: null,
  bookId: null,
  chapterIndex: null,
  page: null,
  context: null,
  learned,
  reviewDue: null,
  reviewStep: 0,
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

describe("review", () => {
  const today = "2026-10-31";
  const due = (w: string, reviewDue: string | null, createdAt = 1, learned = false): SavedWord => ({ ...word(w, createdAt, learned), reviewDue });

  it("asks new and overdue words, the longest overdue first, never known ones", () => {
    const words = [due("later", "2026-11-02"), due("today", today, 2), due("old", "2026-10-20", 3), due("new", null, 4), due("known", null, 5, true)];
    expect(dueWords(words, today).map((w) => w.word)).toEqual(["new", "old", "today"]);
  });

  it("waits longer after each answer known in a row, and marks the word known after the last", () => {
    let w: SavedWord = due("ennui", null);
    const waits: number[] = [];
    for (let i = 0; i < REVIEW_INTERVALS.length; i++) {
      w = { ...w, ...nextReview(w, true, today) };
      waits.push(Math.round((Date.parse(w.reviewDue!) - Date.parse(today)) / 86_400_000));
    }
    expect(waits).toEqual(REVIEW_INTERVALS);
    expect(w.learned).toBe(true);
  });

  it("starts over, tomorrow, after Not yet", () => {
    expect(nextReview({ reviewStep: 4 }, false, today)).toEqual({ reviewDue: "2026-11-01", reviewStep: 0, learned: false });
    expect(nextReview({ reviewStep: 0 }, true, "2026-12-31")).toEqual({ reviewDue: "2027-01-01", reviewStep: 1, learned: false });
  });

  it("says when a word is due", () => {
    expect(dueLabel(due("a", null), today)).toBe("Due today");
    expect(dueLabel(due("a", "2026-11-01"), today)).toBe("Due tomorrow");
    expect(dueLabel(due("a", "2026-11-06"), today)).toBe("Due in 6 days");
    expect(dueLabel(due("a", null, 1, true), today)).toBeNull();
  });
});
