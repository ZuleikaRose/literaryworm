import { describe, expect, it } from "@jest/globals";
import { kidWeek, lastSevenDays } from "./kidsReport";

describe("a Kids profile's week", () => {
  it("covers the 7 days up to today, across a month's end", () => {
    expect(lastSevenDays("2026-11-02")).toEqual(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29", "2026-10-28", "2026-10-27"]);
  });

  it("adds up time, listening, days read and books finished, leaving out older days", () => {
    const week = kidWeek(
      {
        "2026-11-02": { seconds: 1200, finished: 1, listened: 600, books: ["frankenstein"] },
        "2026-10-30": { seconds: 30, finished: 0 },
        "2026-10-28": { seconds: 900, finished: 1, books: ["frankenstein", "dracula"] },
        "2026-10-26": { seconds: 5000, finished: 3 },
      },
      "2026-11-02",
    );
    // Half a minute isn't a day read; the 26th is older than a week.
    expect(week).toEqual({ seconds: 2130, listened: 600, daysRead: 2, finished: 2, books: ["frankenstein", "dracula"] });
  });

  it("is empty for a profile that hasn't read", () => {
    expect(kidWeek({}, "2026-11-02")).toEqual({ seconds: 0, listened: 0, daysRead: 0, finished: 0, books: [] });
  });
});
