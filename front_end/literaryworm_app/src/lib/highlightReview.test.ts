import { describe, expect, it } from "@jest/globals";
import type { Highlight } from "../types";
import { DAILY_HIGHLIGHTS, dueHighlights, HIGHLIGHT_INTERVALS, isHighlightDue, nextHighlightReview, reviewedToday, reviewsLeftToday } from "./highlightReview";

const at = (day: string) => new Date(`${day}T12:00:00`).getTime();
const highlight = (id: string, made: string, patch: Partial<Highlight> = {}): Highlight => ({
  id,
  bookId: "frankenstein",
  chapterIndex: 0,
  page: 0,
  start: 0,
  end: 10,
  quote: `Quote ${id}`,
  color: "yellow",
  note: null,
  createdAt: at(made),
  ...patch,
});

describe("isHighlightDue", () => {
  it("waits until the day after a highlight is made", () => {
    expect(isHighlightDue(highlight("a", "2026-11-01"), "2026-11-01")).toBe(false);
    expect(isHighlightDue(highlight("a", "2026-11-01"), "2026-11-02")).toBe(true);
  });

  it("follows the review day once there is one, on the day itself too", () => {
    const h = highlight("a", "2026-10-01", { reviewDue: "2026-11-05", reviewStep: 2 });
    expect(isHighlightDue(h, "2026-11-04")).toBe(false);
    expect(isHighlightDue(h, "2026-11-05")).toBe(true);
  });
});

describe("dueHighlights", () => {
  it("puts the longest waiting first and leaves out what isn't due", () => {
    const list = [
      highlight("later", "2026-10-20"),
      highlight("scheduled", "2026-09-01", { reviewDue: "2026-10-10", reviewStep: 1 }),
      highlight("future", "2026-09-01", { reviewDue: "2026-12-01", reviewStep: 3 }),
      highlight("today", "2026-11-02"),
    ];
    expect(dueHighlights(list, "2026-11-02").map((h) => h.id)).toEqual(["scheduled", "later"]);
  });

  it("keeps a day to the daily number, and to none for a limit of zero or less", () => {
    const many = Array.from({ length: DAILY_HIGHLIGHTS + 5 }, (_, i) => highlight(`h${i}`, "2026-10-01"));
    expect(dueHighlights(many, "2026-11-02")).toHaveLength(DAILY_HIGHLIGHTS);
    expect(dueHighlights(many, "2026-11-02", 0)).toEqual([]);
    expect(dueHighlights(many, "2026-11-02", -3)).toEqual([]);
  });

  it("is empty with no highlights", () => {
    expect(dueHighlights([], "2026-11-02")).toEqual([]);
  });
});

describe("nextHighlightReview", () => {
  it("steps through the intervals while it still matters", () => {
    let step = 0;
    let day = "2026-11-02";
    for (const days of HIGHLIGHT_INTERVALS) {
      const next = nextHighlightReview({ reviewStep: step }, true, day);
      const gap = (Date.parse(next.reviewDue) - Date.parse(day)) / 86_400_000;
      expect(gap).toBe(days);
      step = next.reviewStep;
      day = next.reviewDue;
    }
    expect(step).toBe(HIGHLIGHT_INTERVALS.length);
  });

  it("stays at the last interval after the last step instead of stopping", () => {
    const last = HIGHLIGHT_INTERVALS.length;
    const next = nextHighlightReview({ reviewStep: last }, true, "2026-11-02");
    expect(next.reviewStep).toBe(last);
    expect((Date.parse(next.reviewDue) - Date.parse("2026-11-02")) / 86_400_000).toBe(HIGHLIGHT_INTERVALS[last - 1]);
  });

  it("brings it back tomorrow at the first step for Again soon, and treats a missing step as 0", () => {
    expect(nextHighlightReview({ reviewStep: 4 }, false, "2026-12-31")).toEqual({ reviewDue: "2027-01-01", reviewStep: 0 });
    expect(nextHighlightReview({ reviewStep: undefined }, true, "2026-11-02")).toEqual({ reviewDue: "2026-11-03", reviewStep: 1 });
  });
});

describe("the daily limit across sittings", () => {
  const day = "2026-11-01";

  it("knows an answer given today from the date it set", () => {
    for (const still of [true, false]) {
      for (const step of [0, 2, 5, 6]) {
        expect(reviewedToday(nextHighlightReview({ reviewStep: step }, still, day), day)).toBe(true);
      }
    }
    expect(reviewedToday({ reviewDue: null, reviewStep: 0 }, day)).toBe(false);
    expect(reviewedToday({ reviewDue: "2026-11-05", reviewStep: 2 }, day)).toBe(false);
  });

  it("doesn't offer a new ten after closing and reopening", () => {
    const answered = Array.from({ length: DAILY_HIGHLIGHTS }, (_, i) => highlight(`a${i}`, "2026-09-01", nextHighlightReview({ reviewStep: 1 }, true, day)));
    const waiting = Array.from({ length: 5 }, (_, i) => highlight(`w${i}`, "2026-09-01"));
    const all = [...answered, ...waiting];
    expect(reviewsLeftToday(all, day)).toBe(0);
    expect(dueHighlights(all, day, reviewsLeftToday(all, day))).toEqual([]);
    expect(dueHighlights(all.slice(3), day, reviewsLeftToday(all.slice(3), day))).toHaveLength(3);
  });
});
