import { describe, expect, it } from "@jest/globals";
import { blendPace, countWords, DEFAULT_WPM, formatTimeLeft, listeningSecondsLeft, MAX_WPM, MIN_WPM, pageSample, readingSecondsLeft } from "./pace";

describe("countWords", () => {
  it("counts words across paragraphs, ignoring extra spaces", () => {
    expect(countWords(["It was a  dark night.", " The end "])).toBe(7);
    expect(countWords([])).toBe(0);
    expect(countWords(["   "])).toBe(0);
  });
});

describe("pageSample", () => {
  it("gives words a minute for a page read normally", () => {
    expect(pageSample(250, 60)).toBe(250);
  });

  it("ignores short pages, glances and pages left open", () => {
    expect(pageSample(20, 30)).toBeNull();
    expect(pageSample(250, 2)).toBeNull();
    expect(pageSample(250, 900)).toBeNull();
    expect(pageSample(300, 5)).toBeNull();
  });
});

describe("blendPace", () => {
  it("starts from the first sample, then moves a fifth of the way", () => {
    expect(blendPace(null, 300)).toBe(300);
    expect(blendPace(200, 300)).toBe(220);
  });

  it("stays within bounds", () => {
    expect(blendPace(MAX_WPM, MAX_WPM * 2)).toBe(MAX_WPM);
    expect(blendPace(MIN_WPM, 1)).toBe(MIN_WPM);
  });
});

describe("time left", () => {
  it("reads at the default pace until there is one", () => {
    expect(readingSecondsLeft(DEFAULT_WPM * 10, null)).toBe(600);
    expect(readingSecondsLeft(600, 300)).toBe(120);
    expect(readingSecondsLeft(-5, 300)).toBe(0);
  });

  it("listens at the player's speed", () => {
    expect(listeningSecondsLeft(3600, 1.5)).toBe(2400);
    expect(listeningSecondsLeft(3600, 0)).toBe(3600);
  });

  it("says it in words", () => {
    expect(formatTimeLeft(30)).toBe("under a minute");
    expect(formatTimeLeft(12 * 60)).toBe("about 12 min");
    expect(formatTimeLeft(3 * 3600 + 5 * 60)).toBe("about 3 h 5 min");
    expect(formatTimeLeft(2 * 3600)).toBe("about 2 h");
  });
});
