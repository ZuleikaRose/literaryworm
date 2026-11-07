import { describe, expect, it } from "@jest/globals";
import { CHARACTERS_PER_HOUR, chapterPieces, naturalVoice } from "./naturalVoice";
import { fitsAllowance, wholeBookPlan } from "./voiceWholeBook";

const narrator = naturalVoice("en-GB-Chirp3-HD-Aoede")!;
const chapters = ["It was cold. “Come in,” said Ann.", "The end of the story."];

describe("voicing a whole upload ahead", () => {
  it("lists every part in reading order, cut as the player cuts them", () => {
    const plan = wholeBookPlan(chapters, narrator, false);
    expect(plan.parts).toEqual([
      [0, 0],
      [1, 0],
    ]);
    const cast = wholeBookPlan(chapters, narrator, true);
    expect(cast.parts.length).toBe(chapterPieces(chapters[0], narrator, true).length + 1);
    expect(plan.characters).toBe(chapters.join("").length);
    expect(plan.hours).toBeCloseTo(plan.characters / CHARACTERS_PER_HOUR);
  });

  it("says whether it fits what's left of the month, and handles empty input", () => {
    const plan = wholeBookPlan(chapters, narrator, false);
    expect(fitsAllowance(plan, 3600)).toBe(true);
    expect(fitsAllowance(plan, 0)).toBe(false);
    expect(fitsAllowance(plan, null)).toBeNull();
    expect(wholeBookPlan([], narrator, true)).toEqual({ parts: [], characters: 0, hours: 0 });
  });
});
