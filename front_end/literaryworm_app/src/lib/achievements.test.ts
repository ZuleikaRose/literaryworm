import { describe, expect, it } from "@jest/globals";
import type { ReadingDay, SavedWord } from "../types";
import { BADGE_RULES, badgeAlerts, badges, earnedBadges } from "./achievements";

const empty = { readingDays: {}, readingGoals: {}, words: [], highlights: [] };
const byId = (list: ReturnType<typeof badges>, id: string) => list.find((b) => b.id === id)!;

/** Days in a row from 1 March 2026, each with half an hour read. */
function run(count: number, extra: Partial<ReadingDay> = {}): Record<string, ReadingDay> {
  const days: Record<string, ReadingDay> = {};
  for (let i = 0; i < count; i++) {
    const d = new Date(2026, 2, 1 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days[key] = { seconds: 1800, finished: 0, ...extra };
  }
  return days;
}

describe("badges", () => {
  it("lists every rule, none earned, with nothing read", () => {
    const list = badges(empty);
    expect(list).toHaveLength(BADGE_RULES.length);
    expect(earnedBadges(list)).toEqual([]);
  });

  it("earns the first finish on the day it happened", () => {
    const list = badges({ ...empty, readingDays: { "2026-03-04": { seconds: 600, finished: 1, books: ["frankenstein"] } } });
    expect(byId(list, "first-book").earnedAt).toBe(new Date(2026, 2, 4).getTime());
    expect(byId(list, "books-10").progress).toBe(1);
  });

  it("counts a week in a row, and a gap starts again", () => {
    const week = badges({ ...empty, readingDays: run(7) });
    expect(byId(week, "streak-7").earnedAt).toBe(new Date(2026, 2, 7).getTime());
    const gap = { ...run(6), "2026-03-08": { seconds: 1800, finished: 0 } };
    expect(byId(badges({ ...empty, readingDays: gap }), "streak-7").earnedAt).toBeNull();
  });

  it("adds up hours and listening", () => {
    const list = badges({ ...empty, readingDays: run(20, { listened: 1800 }) });
    expect(byId(list, "hours-10").earnedAt).toBe(new Date(2026, 2, 20).getTime());
    expect(byId(list, "listener-10").earnedAt).toBe(new Date(2026, 2, 20).getTime());
    expect(byId(list, "hours-100").progress).toBe(10);
  });

  it("finishes a series and reaches a goal", () => {
    const list = badges({
      ...empty,
      readingGoals: { 2026: 2 },
      readingDays: {
        "2026-03-01": { seconds: 600, finished: 1, books: ["alice-in-wonderland"] },
        "2026-03-02": { seconds: 600, finished: 1, books: ["through-the-looking-glass"] },
      },
    });
    expect(byId(list, "series-1").earnedAt).toBe(new Date(2026, 2, 2).getTime());
    expect(byId(list, "goal").earnedAt).toBe(new Date(2026, 2, 2).getTime());
  });

  it("earns Word collector at the tenth word", () => {
    const words = Array.from({ length: 10 }, (_, i): SavedWord => ({
      word: `w${i}`,
      definition: null,
      bookId: null,
      chapterIndex: null,
      page: null,
      context: null,
      learned: false,
      createdAt: 1000 + i,
    }));
    expect(byId(badges({ ...empty, words }), "words-10").earnedAt).toBe(1009);
    expect(byId(badges({ ...empty, words: words.slice(0, 9) }), "words-10").earnedAt).toBeNull();
  });
});

describe("badgeAlerts", () => {
  it("shows badges from the last week only", () => {
    const list = badges({ ...empty, readingDays: { "2026-03-04": { seconds: 600, finished: 1, books: ["frankenstein"] } } });
    const earned = new Date(2026, 2, 4).getTime();
    expect(badgeAlerts(list, earned + 86_400_000)).toHaveLength(1);
    expect(badgeAlerts(list, earned + 8 * 86_400_000)).toHaveLength(0);
  });
});
