import { describe, expect, it } from "@jest/globals";
import { isQuestion, scoreLine } from "./quiz";

describe("isQuestion", () => {
  const good = { question: "Who?", choices: ["A", "B", "C"], answer: 2, explanation: "Because." };

  it("accepts a well-formed question", () => {
    expect(isQuestion(good)).toBe(true);
    expect(isQuestion({ ...good, choices: ["A", "B", "C", "D"], answer: 3 })).toBe(true);
  });

  it("refuses answers out of range, too few or too many choices, and junk", () => {
    expect(isQuestion({ ...good, answer: 3 })).toBe(false);
    expect(isQuestion({ ...good, answer: 1.5 })).toBe(false);
    expect(isQuestion({ ...good, choices: ["A", "B"], answer: 0 })).toBe(false);
    expect(isQuestion({ ...good, choices: ["A", "B", "C", "D", "E"] })).toBe(false);
    expect(isQuestion({ ...good, choices: [1, 2, 3] })).toBe(false);
    expect(isQuestion(null)).toBe(false);
    expect(isQuestion("question")).toBe(false);
  });
});

describe("scoreLine", () => {
  it("cheers in proportion", () => {
    expect(scoreLine(4, 4)).toBe("4 of 4 right. Brilliant, every one!");
    expect(scoreLine(2, 4)).toBe("2 of 4 right. Well done!");
    expect(scoreLine(0, 3)).toBe("0 of 3 right. Good try. Reading the chapter again might help.");
  });
});
