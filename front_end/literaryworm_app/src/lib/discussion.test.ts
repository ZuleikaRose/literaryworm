import { describe, expect, it } from "@jest/globals";
import { canDiscuss, discussableChapters, isQuestionList, QUESTION_MAX } from "./discussion";

const FIVE = ["Why does she leave?", "What did you make of the letter?", "Who did you side with?", "How does the weather set the mood?", "What would you have done?"];

describe("discussion questions", () => {
  it("are for public-domain titles only", () => {
    expect(canDiscuss({ recording: { tracks: [] } })).toBe(true);
    expect(canDiscuss({})).toBe(false);
  });

  it("offer chapter 1 and every chapter up to the reader's, never further", () => {
    expect(discussableChapters(-1, 10)).toEqual([0]);
    expect(discussableChapters(0, 10)).toEqual([0]);
    expect(discussableChapters(3, 10)).toEqual([0, 1, 2, 3]);
    expect(discussableChapters(40, 3)).toEqual([0, 1, 2]);
  });

  it("accept 5 to 8 questions that end in a question mark", () => {
    expect(isQuestionList(FIVE)).toBe(true);
    expect(isQuestionList([...FIVE, ...FIVE.slice(0, 3)])).toBe(true);
    expect(isQuestionList(FIVE.slice(0, 4))).toBe(false);
    expect(isQuestionList([...FIVE, ...FIVE])).toBe(false);
    expect(isQuestionList([...FIVE.slice(0, 4), "Not a question."])).toBe(false);
    expect(isQuestionList([...FIVE.slice(0, 4), `${"x".repeat(QUESTION_MAX)}?`])).toBe(false);
    expect(isQuestionList("Why?")).toBe(false);
  });
});
