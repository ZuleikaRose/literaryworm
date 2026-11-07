import { describe, expect, it } from "@jest/globals";
import { perWeekError, scheduleAlerts, scheduleStanding, scheduleWeek, scheduleWeeks } from "./clubSchedule";

describe("a club's reading schedule", () => {
  it("counts weeks from the start, with that week's chapters", () => {
    expect(scheduleWeek("2026-11-01", 5, "2026-11-01", 61)).toEqual({ week: 1, startsOn: "2026-11-01", endsOn: "2026-11-07", from: 0, to: 4, finished: false });
    expect(scheduleWeek("2026-11-01", 5, "2026-11-15", 61)).toMatchObject({ week: 3, startsOn: "2026-11-15", from: 10, to: 14 });
    // Before the start it's the first week.
    expect(scheduleWeek("2026-11-01", 5, "2026-10-20", 61).week).toBe(1);
  });

  it("stops at the last chapter, and says when the schedule has finished", () => {
    expect(scheduleWeek("2026-11-01", 5, "2026-12-27", 61)).toMatchObject({ week: 9, from: 40, to: 44 });
    expect(scheduleWeek("2026-11-01", 5, "2027-01-31", 61)).toMatchObject({ from: 60, to: 60, finished: true });
    expect(scheduleWeeks(5, 61)).toBe(13);
    expect(scheduleWeeks(5, 0)).toBe(1);
  });

  it("puts a member ahead, on track or behind by chapters", () => {
    const week = scheduleWeek("2026-11-01", 5, "2026-11-15", 61); // chapters 10–14
    expect(scheduleStanding(16, week)).toEqual({ kind: "ahead", chapters: 2 });
    expect(scheduleStanding(12, week)).toEqual({ kind: "onTrack", chapters: 0 });
    expect(scheduleStanding(7, week)).toEqual({ kind: "behind", chapters: 3 });
    expect(scheduleStanding(-1, week)).toEqual({ kind: "behind", chapters: 11 });
  });

  it("checks the owner's choice, and handles empty input", () => {
    expect(perWeekError(null)).toBeNull();
    expect(perWeekError(5)).toBeNull();
    expect(perWeekError(0)).not.toBeNull();
    expect(perWeekError(2.5)).not.toBeNull();
    expect(scheduleWeek("2026-11-01", 3, "2026-11-01", 0)).toMatchObject({ from: 0, to: 0, finished: true });
  });
});

describe("schedule alerts in the bell", () => {
  const clubs = [
    { id: "a", name: "Sunday Classics", startsOn: "2026-11-01", chaptersPerWeek: 5 },
    { id: "b", name: "No schedule", startsOn: "2026-11-01", chaptersPerWeek: null },
    { id: "c", name: "Quiet", startsOn: "2026-11-01", chaptersPerWeek: 5 },
    { id: "d", name: "Done this week", startsOn: "2026-11-01", chaptersPerWeek: 5 },
  ];
  const places: Record<string, number> = { a: 11, c: 0, d: 14 };
  const book = (id: string) => (id in places ? { place: places[id], chapters: 61 } : null);

  it("reminds about this week's chapters until they're read, in clubs with alerts on", () => {
    const alerts = scheduleAlerts(clubs, (id) => id === "c", book, "2026-11-16");
    expect(alerts.map((a) => [a.clubId, a.week.week, a.week.from, a.week.to])).toEqual([["a", 3, 10, 14]]);
    expect(alerts[0].at).toBe(Date.UTC(2026, 10, 15));
  });

  it("says nothing before a club starts, past the end, or with no clubs", () => {
    expect(scheduleAlerts(clubs, () => false, book, "2026-10-30")).toEqual([]);
    expect(scheduleAlerts(clubs, () => false, book, "2027-06-01")).toEqual([]);
    expect(scheduleAlerts([], () => false, book, "2026-11-16")).toEqual([]);
  });
});
