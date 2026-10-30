import { describe, expect, it } from "vitest";
import type { Highlight, ReadingDay } from "../types";
import { statsYears, yearStats } from "./stats";

const days: Record<string, ReadingDay> = {
  "2025-12-31": { seconds: 600, finished: 0 },
  "2026-01-01": { seconds: 1200, finished: 1, listened: 600, books: ["dune"] },
  "2026-01-02": { seconds: 600, finished: 1, listened: 9999, books: ["unknown-id"] },
  "2026-03-04": { seconds: 30, finished: 0 },
};

const highlight = (createdAt: number, note: string | null): Highlight => ({
  id: String(createdAt),
  bookId: "dune",
  chapterIndex: 0,
  page: 0,
  start: 0,
  end: 1,
  quote: "x",
  color: "yellow",
  note,
  createdAt,
});

describe("statsYears", () => {
  it("lists years with reading, newest first, always with the current one", () => {
    expect(statsYears(days, 2027)).toEqual([2027, 2026, 2025]);
    expect(statsYears({ "2030-01-01": { seconds: 60, finished: 0 } }, 2026)).toEqual([2026]);
  });
});

describe("yearStats", () => {
  const stats = yearStats(
    days,
    [highlight(Date.UTC(2026, 5, 1, 12), "a note"), highlight(Date.UTC(2026, 6, 1, 12), null), highlight(Date.UTC(2024, 0, 2, 12), null)],
    2026,
  );

  it("adds up time, caps listening at the day's time, and counts books", () => {
    expect(stats.seconds).toBe(1830);
    expect(stats.listened).toBe(1200);
    expect(stats.read).toBe(630);
    expect(stats.finished).toBe(2);
    expect(stats.daysRead).toBe(2);
    expect(stats.longestStreak).toBe(2);
  });

  it("lists finished books newest first, including ones it can't name", () => {
    expect(stats.books.map((b) => [b.id, Boolean(b.book)])).toEqual([
      ["unknown-id", false],
      ["dune", true],
    ]);
    expect(stats.authors).toEqual([{ name: "Frank Herbert", count: 1 }]);
  });

  it("finds the busiest month and counts the year's highlights and notes", () => {
    expect(stats.busiestMonth).toBe(0);
    expect(stats.months[2].seconds).toBe(30);
    expect(stats.highlights).toBe(2);
    expect(stats.notes).toBe(1);
  });

  it("has no busiest month or weekday in an empty year", () => {
    const empty = yearStats({}, [], 2020);
    expect(empty.busiestMonth).toBeNull();
    expect(empty.favouriteWeekday).toBeNull();
  });
});
