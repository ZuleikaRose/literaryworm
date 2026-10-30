import { describe, expect, it } from "@jest/globals";
import { listenedSoFar, listenedThisMonth, listeningLeft, monthRange, nextMonthLabel, planLimits } from "./planLimits";

describe("plan limits", () => {
  it("matches the plan cards, and gives an account without a plan Basic's", () => {
    expect(planLimits("basic")).toEqual({ audioSeconds: 5 * 3600, offlineDevices: 1 });
    expect(planLimits("standard")).toEqual({ audioSeconds: 30 * 3600, offlineDevices: 3 });
    expect(planLimits("premium")).toEqual({ audioSeconds: null, offlineDevices: 5 });
    expect(planLimits(null)).toEqual(planLimits("basic"));
  });

  it("finds the month's first and last days, leap years included", () => {
    expect(monthRange("2026-10-30")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(nextMonthLabel("2026-12-31")).toBe("1 January");
    expect(nextMonthLabel("2026-10-05")).toBe("1 November");
  });

  it("adds up every profile's listening in the month, not reading or other months", () => {
    const avery = { "2026-10-01": { seconds: 900, finished: 0, listened: 600 }, "2026-09-30": { seconds: 7200, finished: 0, listened: 7200 } };
    const sam = { "2026-10-30": { seconds: 300, finished: 0, listened: 300 }, "2026-10-12": { seconds: 1200, finished: 1 } };
    expect(listenedThisMonth([avery, sam], "2026-10-30")).toBe(900);
    expect(listenedThisMonth([], "2026-10-30")).toBe(0);
  });

  it("counts other devices from the server's total, and this device's listening since", () => {
    // Another device listened an hour this device hasn't loaded; this device has 10 minutes more since the check.
    expect(listenedSoFar(5400, 1800, 2400)).toBe(6000);
    // This device's minutes not saved yet aren't lost when the server is behind.
    expect(listenedSoFar(1200, 1800, 1800)).toBe(1800);
    expect(listenedSoFar(0, 0, 0)).toBe(0);
  });

  it("says how much listening is left, and that Premium has no limit", () => {
    expect(listeningLeft("basic", 3600)).toBe(4 * 3600);
    expect(listeningLeft("basic", 6 * 3600)).toBe(0);
    expect(listeningLeft("standard", 0)).toBe(30 * 3600);
    expect(listeningLeft("premium", 1_000_000)).toBeNull();
  });
});
