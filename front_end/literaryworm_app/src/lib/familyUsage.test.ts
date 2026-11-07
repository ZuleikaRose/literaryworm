import { describe, expect, it } from "@jest/globals";
import { familyUsage, monthOf } from "./familyUsage";
import { CHARACTERS_PER_HOUR } from "./naturalVoice";

describe("the family listening report", () => {
  it("adds up each profile's listening this month and its natural-voice reading, most first", () => {
    const profiles = [
      { id: "a", name: "Avery" },
      { id: "s", name: "Sam" },
      { id: "m", name: "Mia" },
    ];
    const data = {
      a: { readingDays: { "2026-11-02": { seconds: 900, finished: 0, listened: 600 }, "2026-10-30": { seconds: 900, finished: 0, listened: 900 } } },
      m: { readingDays: { "2026-11-05": { seconds: 1800, finished: 0, listened: 1800 } } },
    };
    const rows = familyUsage(profiles, data, { a: CHARACTERS_PER_HOUR / 2 }, "2026-11");
    expect(rows.map((r) => [r.name, r.listened, r.natural])).toEqual([
      ["Avery", 600, 1800],
      ["Mia", 1800, 0],
      ["Sam", 0, 0],
    ]);
    expect(monthOf("2026-11-07")).toBe("2026-11");
  });
});
