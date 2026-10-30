import { describe, expect, it } from "@jest/globals";
import type { ReadingDay } from "../types";
import { booksFinishedIn, expectedByNow, goalAlerts, monthSummaries, readingTime, streaks } from "./goals";

const day = (seconds: number, finished = 0): ReadingDay => ({ seconds, finished });

describe("streaks", () => {
  const days = {
    "2026-03-01": day(600),
    "2026-03-02": day(600),
    "2026-03-03": day(600),
    "2026-03-05": day(30), // under a minute: doesn't count
    "2026-03-09": day(120),
    "2026-03-10": day(120),
  };

  it("counts up to today", () => {
    expect(streaks(days, "2026-03-10")).toEqual({ current: 2, longest: 3 });
  });

  it("keeps the streak going while today has nothing yet", () => {
    expect(streaks(days, "2026-03-11").current).toBe(2);
  });

  it("drops to 0 after a missed day", () => {
    expect(streaks(days, "2026-03-12").current).toBe(0);
  });

  it("is 0 with no reading days", () => {
    expect(streaks({}, "2026-03-10")).toEqual({ current: 0, longest: 0 });
  });

  it("runs across the end of a year", () => {
    expect(streaks({ "2025-12-31": day(60), "2026-01-01": day(60) }, "2026-01-01")).toEqual({ current: 2, longest: 2 });
  });
});

describe("totals", () => {
  const days = { "2025-12-30": day(60, 1), "2026-01-02": day(3600, 2), "2026-02-10": day(30, 1) };

  it("counts books finished in a year", () => {
    expect(booksFinishedIn(days, 2026)).toBe(3);
    expect(booksFinishedIn(days, 2025)).toBe(1);
  });

  it("summarises months newest first, across the end of a year", () => {
    const months = monthSummaries(days, "2026-02-15", 3);
    expect(months.map((m) => m.month)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(months[0]).toEqual({ month: "2026-02", seconds: 30, daysRead: 0, finished: 1 });
    expect(months[1]).toEqual({ month: "2026-01", seconds: 3600, daysRead: 1, finished: 2 });
  });

  it("gives empty months and no books with no reading days", () => {
    expect(booksFinishedIn({}, 2026)).toBe(0);
    expect(monthSummaries({}, "2026-02-15", 2)).toEqual([
      { month: "2026-02", seconds: 0, daysRead: 0, finished: 0 },
      { month: "2026-01", seconds: 0, daysRead: 0, finished: 0 },
    ]);
  });
});

describe("expectedByNow", () => {
  it("is one day's share on 1 January and the whole goal on 31 December", () => {
    expect(expectedByNow(365, "2026-01-01")).toBeCloseTo(1);
    expect(expectedByNow(12, "2026-12-31")).toBeCloseTo(12);
  });
});

it("writes reading time", () => {
  expect(readingTime(12_000)).toBe("3 h 20 min");
  expect(readingTime(3600)).toBe("1 h");
  expect(readingTime(300)).toBe("5 min");
  expect(readingTime(59)).toBe("0 min");
  expect(readingTime(0)).toBe("0 min");
});

describe("goal alerts for the bell", () => {
  const day = (seconds: number, finished = 0) => ({ seconds, finished });
  const streakDays = { "2026-10-27": day(600), "2026-10-28": day(600), "2026-10-29": day(600) };

  it("nudges a streak of 3 days or more from 6 pm, until the profile reads today", () => {
    expect(goalAlerts(streakDays, {}, "2026-10-30", new Date(2026, 9, 30, 17, 59))).toEqual([]);
    const [nudge] = goalAlerts(streakDays, {}, "2026-10-30", new Date(2026, 9, 30, 19));
    expect(nudge).toEqual({ kind: "streak", days: 3, at: new Date(2026, 9, 30, 18).getTime() });
    expect(goalAlerts({ ...streakDays, "2026-10-30": day(120) }, {}, "2026-10-30", new Date(2026, 9, 30, 19))).toEqual([]);
    const { "2026-10-27": _, ...twoDays } = streakDays;
    expect(goalAlerts(twoDays, {}, "2026-10-30", new Date(2026, 9, 30, 19))).toEqual([]);
  });

  it("says when this year's goal is 2 books or fewer away, from the day that became true", () => {
    const days = { "2026-03-01": day(600, 5), "2026-10-02": day(600, 3), "2026-10-20": day(600, 1) };
    expect(goalAlerts(days, { 2026: 10 }, "2026-10-30", new Date(2026, 9, 30, 12))).toEqual([
      { kind: "close", left: 1, goal: 10, year: 2026, at: new Date(2026, 9, 2).getTime() },
    ]);
    expect(goalAlerts(days, { 2026: 20 }, "2026-10-30", new Date(2026, 9, 30, 12))).toEqual([]);
    // Last year's goal and books don't count.
    expect(goalAlerts(days, { 2025: 10 }, "2026-10-30", new Date(2026, 9, 30, 12))).toEqual([]);
  });

  it("celebrates the goal for a week from the day it was reached", () => {
    const days = { "2026-10-01": day(600, 8), "2026-10-25": day(600, 2) };
    const reached = { kind: "reached", goal: 10, year: 2026, at: new Date(2026, 9, 25).getTime() };
    expect(goalAlerts(days, { 2026: 10 }, "2026-10-30", new Date(2026, 9, 30, 12))).toEqual([reached]);
    expect(goalAlerts(days, { 2026: 10 }, "2026-11-02", new Date(2026, 10, 2, 12))).toEqual([]);
  });
});
