import { describe, expect, it } from "@jest/globals";
import { isEmptyMood, isMood, MOODS, MOODS_MAX, moodSummary, toggleMood } from "./moods";

describe("moods", () => {
  it("has 14 moods, three at most a book", () => {
    expect(MOODS).toHaveLength(14);
    expect(MOODS_MAX).toBe(3);
    expect(isMood("funny")).toBe(true);
    expect(isMood("grumpy")).toBe(false);
    expect(isMood(null)).toBe(false);
  });

  it("turns moods on and off in list order, and refuses a fourth", () => {
    expect(toggleMood([], "tense")).toEqual(["tense"]);
    expect(toggleMood(["tense"], "dark")).toEqual(["dark", "tense"]);
    expect(toggleMood(["dark", "tense"], "dark")).toEqual(["tense"]);
    expect(toggleMood(["dark", "funny", "tense"], "sad")).toBeNull();
    expect(toggleMood(["dark", "funny", "tense"], "funny")).toEqual(["dark", "tense"]);
  });

  it("knows an empty tag and writes a short summary", () => {
    expect(isEmptyMood(undefined)).toBe(true);
    expect(isEmptyMood({ moods: [], pace: null })).toBe(true);
    expect(isEmptyMood({ moods: [], pace: "fast" })).toBe(false);
    expect(moodSummary({ moods: ["funny", "hopeful"], pace: "fast" })).toBe("Funny, hopeful · Fast pace");
    expect(moodSummary({ moods: [], pace: "slow" })).toBe("Slow pace");
    expect(moodSummary({ moods: ["dark"], pace: null })).toBe("Dark");
    expect(moodSummary(null)).toBe("");
  });
});
