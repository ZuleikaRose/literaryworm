import { describe, expect, it } from "@jest/globals";
import type { ReadingDay } from "../types";
import {
  THEME_PROMPTS,
  type ThemeBook,
  themesCovered,
  type Challenge,
  challengeError,
  challengeLength,
  challengeStatus,
  challengeValue,
  daysLeft,
  defaultTitle,
  presetRange,
  rangeLabel,
  standings,
  unit,
} from "./challenges";

const day = (seconds: number, finished = 0): ReadingDay => ({ seconds, finished });
const days: Record<string, ReadingDay> = {
  "2026-10-31": day(7200, 1), // before the range
  "2026-11-01": day(3600, 1),
  "2026-11-02": day(30), // under a minute: not a day with reading
  "2026-11-15": day(5400, 2),
  "2026-11-30": day(120),
  "2026-12-01": day(3600, 1), // after
};

describe("challengeValue", () => {
  it("counts only the days in the range, both ends included", () => {
    expect(challengeValue("books", days, "2026-11-01", "2026-11-30")).toBe(3);
    expect(challengeValue("days", days, "2026-11-01", "2026-11-30")).toBe(3);
  });

  it("counts whole hours of reading and listening", () => {
    expect(challengeValue("hours", days, "2026-11-01", "2026-11-30")).toBe(2);
  });

  it("is 0 with no reading", () => {
    expect(challengeValue("books", {}, "2026-11-01", "2026-11-30")).toBe(0);
  });
});

describe("dates", () => {
  it("knows whether a challenge is upcoming, on or over", () => {
    const c = { startsOn: "2026-11-01", endsOn: "2026-11-30" };
    expect(challengeStatus(c, "2026-10-31")).toBe("upcoming");
    expect(challengeStatus(c, "2026-11-01")).toBe("active");
    expect(challengeStatus(c, "2026-11-30")).toBe("active");
    expect(challengeStatus(c, "2026-12-01")).toBe("ended");
  });

  it("counts days left including today", () => {
    expect(daysLeft({ endsOn: "2026-11-30" }, "2026-11-30")).toBe(1);
    expect(daysLeft({ endsOn: "2026-11-30" }, "2026-11-01")).toBe(30);
    expect(challengeLength("2028-02-01", "2028-02-29")).toBe(29);
  });

  it("works out the presets, across the end of a year", () => {
    expect(presetRange("this-month", "2026-11-14")).toEqual({ startsOn: "2026-11-01", endsOn: "2026-11-30" });
    expect(presetRange("next-month", "2026-12-14")).toEqual({ startsOn: "2027-01-01", endsOn: "2027-01-31" });
    expect(presetRange("next-30", "2026-12-14")).toEqual({ startsOn: "2026-12-14", endsOn: "2027-01-12" });
  });
});

describe("words", () => {
  it("names a challenge after its target and dates", () => {
    expect(defaultTitle("books", 5, "2026-11-01", "2026-11-30")).toBe("5 books in November");
    expect(defaultTitle("books", 1, "2027-02-01", "2027-02-28")).toBe("1 book in February");
    expect(defaultTitle("hours", 20, "2026-11-14", "2026-12-13")).toBe("20 hours by 13 December");
    expect(defaultTitle("days", 10, "2026-11-01", "2026-11-29")).toBe("10 days by 29 November");
  });

  it("writes ranges and units", () => {
    expect(rangeLabel("2026-11-01", "2026-11-30")).toBe("1 November – 30 November");
    expect([unit("books", 1), unit("hours", 2), unit("days", 0)]).toEqual(["book", "hours", "days"]);
  });
});

describe("standings", () => {
  const challenge: Challenge = {
    id: "c1",
    title: "3 books in November",
    kind: "books",
    target: 3,
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    createdBy: "avery",
    participants: ["sam", "avery", "mia"],
  };

  it("puts the furthest along first, marks who's done, and counts a profile with no days as 0", () => {
    const result = standings(challenge, { avery: days, sam: { "2026-11-03": day(600, 1) } });
    expect(result).toEqual([
      { profileId: "avery", value: 3, done: true },
      { profileId: "sam", value: 1, done: false },
      { profileId: "mia", value: 0, done: false },
    ]);
  });

  it("is empty when nobody has joined", () => {
    expect(standings({ ...challenge, participants: [] }, {})).toEqual([]);
  });
});

describe("challengeError", () => {
  const ok = { title: "5 books in November", kind: "books" as const, target: 5, startsOn: "2026-11-01", endsOn: "2026-11-30" };
  const today = "2026-10-30";

  it("takes a sound challenge", () => {
    expect(challengeError(ok, today)).toBeNull();
    expect(challengeError({ ...ok, kind: "days", target: 30 }, today)).toBeNull();
  });

  it("asks for a name of 80 characters at most", () => {
    expect(challengeError({ ...ok, title: "   " }, today)).toMatch(/name/);
    expect(challengeError({ ...ok, title: "x".repeat(81) }, today)).toMatch(/80 characters/);
  });

  it("asks for a whole-number target from 1 to 1000", () => {
    for (const target of [0, 1001, 2.5, Number.NaN]) expect(challengeError({ ...ok, target }, today)).toMatch(/whole number/);
  });

  it("checks the dates", () => {
    expect(challengeError({ ...ok, startsOn: "" }, today)).toMatch(/starts and ends/);
    expect(challengeError({ ...ok, endsOn: "2026-10-31", startsOn: "2026-11-01" }, today)).toMatch(/before the start/);
    expect(challengeError({ ...ok, startsOn: "2026-09-01", endsOn: "2026-09-30" }, today)).toMatch(/haven't passed/);
    expect(challengeError({ ...ok, endsOn: "2027-11-30" }, today)).toMatch(/a year at most/);
    expect(challengeError({ ...ok, kind: "days", target: 31 }, today)).toMatch(/only 30 days/);
  });
});

describe("themes covered", () => {
  const books: Record<string, ThemeBook> = {
    old: { year: 1818, genres: ["Classics", "Horror"], pages: 280, language: "en", inSeries: false },
    french: { year: 1950, genres: ["Literary fiction"], pages: 500, language: "fr", inSeries: true },
    poems: { year: 1950, genres: ["Poetry"], pages: 90, language: "en", inSeries: false },
  };
  const bookOf = (id: string) => books[id];
  const days: Record<string, ReadingDay> = {
    "2026-11-02": { seconds: 600, finished: 1, books: ["old"] },
    "2026-11-05": { seconds: 600, finished: 2, books: ["french", "unknown"] },
    "2026-10-01": { seconds: 600, finished: 1, books: ["poems"] },
  };

  it("counts each theme a book finished in the dates fits, once", () => {
    // old: before 1900 + a ghost story; french: another language + 400 pages + a series. Poems were before the start.
    expect(themesCovered(days, "2026-11-01", "2026-11-30", bookOf).sort()).toEqual(["language", "long", "mystery", "old", "series"]);
    expect(challengeValue("themes", days, "2026-11-01", "2026-11-30", bookOf)).toBe(5);
    expect(challengeValue("themes", days, "2026-11-01", "2026-11-30")).toBe(0);
  });

  it("keeps the target to the nine themes, and handles empty input", () => {
    const input = { title: "Around", kind: "themes" as const, target: 10, startsOn: "2026-11-01", endsOn: "2026-11-30" };
    expect(challengeError(input, "2026-11-01")).toMatch(/9 themes/);
    expect(challengeError({ ...input, target: 9 }, "2026-11-01")).toBeNull();
    expect(themesCovered({}, "2026-11-01", "2026-11-30", bookOf)).toEqual([]);
    expect(THEME_PROMPTS).toHaveLength(9);
  });
});
