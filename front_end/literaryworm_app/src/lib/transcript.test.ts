import { describe, expect, it } from "@jest/globals";
import { wordAt } from "./transcript";


describe("the word being spoken", () => {
  it("follows the share of the sentence's letters", () => {
    const text = "It was a dark night.";
    const word = (share: number) => {
      const w = wordAt(text, share)!;
      return text.slice(w.start, w.end);
    };
    expect(word(0)).toBe("It");
    expect(word(0.3)).toBe("a");
    expect(word(0.6)).toBe("dark");
    expect(word(0.99)).toBe("night.");
    expect(word(2)).toBe("night.");
    expect(word(-1)).toBe("It");
  });

  it("has no word in an empty sentence", () => {
    expect(wordAt("", 0.5)).toBeNull();
    expect(wordAt("   ", 0.5)).toBeNull();
  });
});
