import { describe, expect, it } from "@jest/globals";
import { addBookTime, bookDaysFromRows, bookStats, PACE_MIN_SECONDS, paceText, spentText } from "./bookStats";

describe("addBookTime", () => {
  it("starts a day where the reader is and moves its end on", () => {
    let all = addBookTime(undefined, "dune", "2026-11-01", 60, false, 0.1);
    all = addBookTime(all, "dune", "2026-11-01", 120, true, 0.15);
    expect(all.dune["2026-11-01"]).toEqual({ seconds: 180, listened: 120, from: 0.1, to: 0.15 });
  });

  it("keeps the last known place when one isn't given, and clamps", () => {
    let all = addBookTime(undefined, "dune", "2026-11-01", 60, false, 1.4);
    all = addBookTime(all, "dune", "2026-11-01", 60, false, null);
    expect(all.dune["2026-11-01"]).toMatchObject({ from: 1, to: 1 });
  });

  it("keeps other books and days", () => {
    const all = addBookTime(addBookTime(undefined, "a", "2026-11-01", 60, false, 0), "b", "2026-11-02", 30, false, 0);
    expect(Object.keys(all)).toEqual(["a", "b"]);
  });
});

describe("bookStats", () => {
  const days = {
    "2026-10-28": { seconds: 1800, listened: 0, from: 0, to: 0.1 },
    "2026-10-30": { seconds: 3600, listened: 1800, from: 0.1, to: 0.3 },
    "2026-10-31": { seconds: 600, listened: 0, from: null, to: null },
  };

  it("adds up time, days and the biggest days", () => {
    const s = bookStats(days, 0.3)!;
    expect(s).toMatchObject({ seconds: 6000, listened: 1800, days: 3, first: "2026-10-28", last: "2026-10-31" });
    expect(s.topDays.map((d) => d.day)).toEqual(["2026-10-30", "2026-10-28", "2026-10-31"]);
  });

  it("works out the pace from days with places, and the time left at it", () => {
    const s = bookStats(days, 0.3)!;
    // 0.3 of the book in 1.5 hours with places known.
    expect(s.perHour).toBeCloseTo(0.2);
    expect(s.leftSeconds).toBe(Math.round((0.7 / 0.2) * 3600));
  });

  it("gives no pace for too little time or no movement, and no time left when finished", () => {
    expect(bookStats({ d: { seconds: PACE_MIN_SECONDS - 60, listened: 0, from: 0, to: 0.1 } })!.perHour).toBeNull();
    expect(bookStats({ d: { seconds: 3600, listened: 0, from: 0.2, to: 0.2 } })!.perHour).toBeNull();
    expect(bookStats(days, 1)!.leftSeconds).toBeNull();
  });

  it("is null without time", () => {
    expect(bookStats(undefined)).toBeNull();
    expect(bookStats({ d: { seconds: 0, listened: 0, from: null, to: null } })).toBeNull();
  });
});

describe("words and rows", () => {
  it("says times and paces plainly", () => {
    expect(spentText(30)).toBe("under a minute");
    expect(spentText(45 * 60)).toBe("45 min");
    expect(spentText(2 * 3600)).toBe("2 hr");
    expect(spentText(3 * 3600 + 20 * 60)).toBe("3 hr 20 min");
    expect(paceText(0.123)).toBe("About 12% of the book an hour");
    expect(paceText(0.004)).toBe("Under 1% of the book an hour");
  });

  it("reads Supabase rows, whose numerics may be strings", () => {
    expect(bookDaysFromRows([{ day: "2026-11-01", minutes: 3, listening_minutes: 1, fraction_from: "0.1000", fraction_to: null }])).toEqual({
      "2026-11-01": { seconds: 180, listened: 60, from: 0.1, to: null },
    });
  });
});
