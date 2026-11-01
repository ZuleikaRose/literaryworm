import { describe, expect, it } from "@jest/globals";
import { DEFAULT_WPM } from "./pace";
import { dailyText, daysBetween, PLAN_DAYS_MAX, planDateError, planToday, type ReadingPlan, statusText, WORDS_PER_PAGE } from "./readingPlans";

const plan = (patch: Partial<ReadingPlan> = {}): ReadingPlan => ({ bookId: "dune", finishBy: "2026-11-10", startFraction: 0, startedOn: "2026-11-01", ...patch });
const book = { pages: 300 };

describe("planDateError", () => {
  it("accepts today and days up to two years ahead", () => {
    expect(planDateError("2026-11-01", "2026-11-01")).toBeNull();
    expect(planDateError("2027-03-01", "2026-11-01")).toBeNull();
  });

  it("refuses a past day, one too far ahead, and something that isn't a date", () => {
    expect(planDateError("2026-10-31", "2026-11-01")).toMatch(/still to come/);
    const tooFar = new Date(Date.UTC(2026, 10, 1 + PLAN_DAYS_MAX + 1)).toISOString().slice(0, 10);
    expect(planDateError(tooFar, "2026-11-01")).toMatch(/two years/);
    expect(planDateError("", "2026-11-01")).toMatch(/Choose the day/);
    expect(planDateError("next week", "2026-11-01")).toMatch(/Choose the day/);
  });
});

describe("planToday", () => {
  it("splits what's left over the days left, today included", () => {
    // Ten days, 300 pages: 30 a day.
    const t = planToday(plan(), book, 0, "2026-11-01", null, null);
    expect(t.daysLeft).toBe(10);
    expect(t.pagesPerDay).toBe(30);
    expect(t.minutesPerDay).toBe(Math.ceil((300 * WORDS_PER_PAGE) / DEFAULT_WPM / 10));
    expect(t.status).toBe("on-track");
  });

  it("uses the measured pace through the book when there is one", () => {
    // 10% of the book an hour, half left over 5 days: an hour a day.
    const t = planToday(plan({ finishBy: "2026-11-05" }), book, 0.5, "2026-11-01", 0.1, null);
    expect(t.minutesPerDay).toBe(60);
  });

  it("uses the profile's words a minute before the pace is measured", () => {
    const slow = planToday(plan(), book, 0, "2026-11-01", null, 100);
    const fast = planToday(plan(), book, 0, "2026-11-01", null, 500);
    expect(slow.minutesPerDay).toBeGreaterThan(fast.minutesPerDay);
  });

  it("says ahead or behind by whole days of a steady pace", () => {
    // Day 5 of 10 (4 days gone): a steady pace is at 40%.
    expect(planToday(plan(), book, 0.6, "2026-11-05", null, null)).toMatchObject({ status: "ahead", daysAhead: 2 });
    expect(planToday(plan(), book, 0.25, "2026-11-05", null, null)).toMatchObject({ status: "behind", daysAhead: -1 });
    expect(planToday(plan(), book, 0.45, "2026-11-05", null, null).status).toBe("on-track");
  });

  it("is done at the end of the book, and overdue once the day has passed", () => {
    expect(planToday(plan(), book, 1, "2026-11-05", null, null).status).toBe("done");
    const late = planToday(plan(), book, 0.5, "2026-11-11", null, null);
    expect(late).toMatchObject({ status: "overdue", daysLeft: 0 });
    // What's left still shows, as if it were one day.
    expect(late.pagesPerDay).toBe(150);
  });

  it("leaves pages out for a book with no page count, and clamps a place outside 0–1", () => {
    expect(planToday(plan(), { pages: 0 }, 0, "2026-11-01", null, null).pagesPerDay).toBeNull();
    expect(planToday(plan(), book, 1.4, "2026-11-01", null, null).status).toBe("done");
    expect(planToday(plan(), book, -1, "2026-11-01", null, null).pagesPerDay).toBe(30);
  });
});

describe("the words", () => {
  it("names minutes, hours and pages", () => {
    expect(dailyText({ minutesPerDay: 25, pagesPerDay: 14 })).toBe("About 25 minutes or 14 pages a day");
    expect(dailyText({ minutesPerDay: 1, pagesPerDay: 1 })).toBe("About 1 minute or 1 page a day");
    expect(dailyText({ minutesPerDay: 90, pagesPerDay: null })).toBe("About 1 hr 30 min a day");
    expect(dailyText({ minutesPerDay: 120, pagesPerDay: null })).toBe("About 2 hr a day");
  });

  it("names the status", () => {
    expect(statusText({ status: "ahead", daysAhead: 1 })).toBe("1 day ahead");
    expect(statusText({ status: "behind", daysAhead: -3 })).toBe("3 days behind");
    expect(statusText({ status: "on-track", daysAhead: 0 })).toBe("On track");
    expect(statusText({ status: "done", daysAhead: 0 })).toBe("Finished");
    expect(statusText({ status: "overdue", daysAhead: 0 })).toBe("The date has passed");
  });

  it("counts days across a month end", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});
