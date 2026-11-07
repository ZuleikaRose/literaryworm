import { describe, expect, it } from "@jest/globals";
import { BEDTIME_CHAPTER_MAX_SECONDS, BEDTIME_MINUTES, bedtimeTimer, nearBedtime } from "./bedtimeListening";

const at = (h: number, m: number) => new Date(2026, 10, 7, h, m);

describe("bedtime listening", () => {
  it("stops at the end of the chapter when it's near, else after the usual minutes", () => {
    expect(bedtimeTimer(10 * 60, 1)).toBe("chapter");
    expect(bedtimeTimer(BEDTIME_CHAPTER_MAX_SECONDS, 1)).toBe("chapter");
    expect(bedtimeTimer(BEDTIME_CHAPTER_MAX_SECONDS + 1, 1)).toBe(String(BEDTIME_MINUTES));
    // Faster playing gets to the end of the chapter sooner.
    expect(bedtimeTimer(30 * 60, 2)).toBe("chapter");
    // At the very end of a chapter, the next one would stop at once: use minutes.
    expect(bedtimeTimer(0, 1)).toBe(String(BEDTIME_MINUTES));
  });

  it("knows when bedtime is coming up, across midnight too", () => {
    expect(nearBedtime(at(19, 30), "20:00")).toBe(true);
    expect(nearBedtime(at(19, 0), "20:00")).toBe(false);
    expect(nearBedtime(at(20, 0), "20:00")).toBe(false);
    expect(nearBedtime(at(23, 50), "00:15")).toBe(true);
    expect(nearBedtime(at(19, 30), null)).toBe(false);
    expect(nearBedtime(at(19, 30), "8pm")).toBe(false);
    expect(nearBedtime(at(19, 50), "20:00", 5)).toBe(false);
  });
});
