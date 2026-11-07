import { describe, expect, it } from "@jest/globals";
import { PARAGRAPH_GRACE_SECONDS, paragraphEndShare, sleepSecondsToParagraphEnd } from "./sleepParagraph";

// Two paragraphs: 9 letters, a break, 9 letters ("aaaa aaaa bbbb bbbb" collapsed is 19 long).
const chapter = "aaaa aaaa\n\nbbbb bbbb";

describe("a sleep timer that ends with the paragraph", () => {
  it("finds the end of the paragraph a place is in", () => {
    expect(paragraphEndShare(chapter, 0.1)).toBeCloseTo(9 / 19);
    expect(paragraphEndShare(chapter, 0.6)).toBe(1);
    expect(paragraphEndShare("", 0.5)).toBe(1);
  });

  it("runs the minutes on to the paragraph's end, by no more than the grace", () => {
    const base = { position: 0, speed: 1, starts: [0], texts: [chapter] };
    // A 1,900-second chapter: 10 minutes in, the paragraph ends at 900 s, 300 s on: past the grace, so 10 minutes.
    expect(300).toBeGreaterThan(PARAGRAPH_GRACE_SECONDS);
    expect(sleepSecondsToParagraphEnd({ ...base, minutes: 10, lengths: [1900] })).toBe(600);
    // A shorter chapter: the paragraph ends 60 seconds after the minutes run out.
    expect(sleepSecondsToParagraphEnd({ ...base, minutes: 2, lengths: [342] })).toBeCloseTo(162);
    // At double speed the extra listening is halved.
    expect(sleepSecondsToParagraphEnd({ ...base, speed: 2, minutes: 1, lengths: [342] })).toBeCloseTo(60 + 21);
    // Nothing to go on: the minutes as chosen.
    expect(sleepSecondsToParagraphEnd({ ...base, texts: [], minutes: 5, lengths: [342] })).toBe(300);
  });
});
