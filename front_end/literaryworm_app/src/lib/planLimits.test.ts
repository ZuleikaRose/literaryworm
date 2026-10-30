import { describe, expect, it } from "@jest/globals";
import { bellCount, isNewListeningAlert } from "./notifications";
import { hoursAndMinutes, listenedSoFar, listenedThisMonth, listeningAlert, listeningLeft, monthRange, nextMonthLabel, nextPlanUp, planCheckoutPath, planLimits, tooBigFor } from "./planLimits";
import { planById } from "../data/plans";

describe("plan limits", () => {
  it("matches the plan cards, and gives an account without a plan Basic's", () => {
    expect(planLimits("basic")).toEqual({ audioSeconds: 5 * 3600, offlineDevices: 1 });
    expect(planLimits("standard")).toEqual({ audioSeconds: 30 * 3600, offlineDevices: 10 });
    expect(planLimits("premium")).toEqual({ audioSeconds: null, offlineDevices: 24 });
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

describe("the listening heads-up", () => {
  const now = new Date(2026, 9, 30, 18, 0, 0);
  const hours = (h: number) => h * 3600;

  it("comes once the household passes 80% of the month, dated the day it did", () => {
    const avery = { "2026-10-02": { seconds: hours(2), finished: 0, listened: hours(2) }, "2026-10-20": { seconds: hours(2), finished: 0, listened: hours(2) } };
    const sam = { "2026-10-25": { seconds: hours(1), finished: 0, listened: hours(1) } };
    const alert = listeningAlert("basic", [avery, sam], now)!;
    expect(alert.used).toBe(hours(5));
    expect(alert.limit).toBe(hours(5));
    // 4 of 5 hours (80%) was reached on the 20th.
    expect(alert.crossedAt).toBe(new Date(2026, 9, 20).getTime());
  });

  it("dates a crossing today by how long ago it was", () => {
    const today = { "2026-10-30": { seconds: hours(4.5), finished: 0, listened: hours(4.5) } };
    // Half an hour past the 4-hour mark.
    expect(listeningAlert("basic", [today], now)!.crossedAt).toBe(now.getTime() - 1800 * 1000);
  });

  it("stays quiet below 80%, on Premium, and for last month's listening", () => {
    const days = { "2026-10-01": { seconds: hours(3.9), finished: 0, listened: hours(3.9) }, "2026-09-30": { seconds: hours(20), finished: 0, listened: hours(20) } };
    expect(listeningAlert("basic", [days], now)).toBeNull();
    expect(listeningAlert("premium", [{ "2026-10-01": { seconds: hours(100), finished: 0, listened: hours(100) } }], now)).toBeNull();
  });

  it("counts on the bell until it's seen", () => {
    const alert = { used: hours(4), limit: hours(5), crossedAt: 1000 };
    expect(isNewListeningAlert(alert, null)).toBe(true);
    expect(isNewListeningAlert(alert, 500)).toBe(true);
    expect(isNewListeningAlert(alert, 2000)).toBe(false);
    expect(isNewListeningAlert(null, null)).toBe(false);
    expect(bellCount([], 500, [], [], now, alert)).toBe(1);
    expect(bellCount([], 2000, [], [], now, alert)).toBe(0);
  });

  it("writes hours and minutes", () => {
    expect(hoursAndMinutes(0)).toBe("0 min");
    expect(hoursAndMinutes(45 * 60)).toBe("45 min");
    expect(hoursAndMinutes(5 * 3600)).toBe("5 h");
    expect(hoursAndMinutes(2 * 3600 + 10 * 60 + 59)).toBe("2 h 10 min");
  });
});

describe("moving up a plan", () => {
  it("offers the next plan up, Basic to Standard to Premium, and nothing past Premium", () => {
    expect(nextPlanUp("basic")?.id).toBe("standard");
    expect(nextPlanUp("standard")?.id).toBe("premium");
    expect(nextPlanUp("premium")).toBeNull();
    expect(nextPlanUp(null)?.id).toBe("basic");
  });

  it("links straight to that plan's checkout on Plans", () => {
    expect(planCheckoutPath(nextPlanUp("basic")!)).toBe("/plans?plan=standard");
  });
});

describe("moving down a plan", () => {
  const standard = planById.get("standard")!;
  const basic = planById.get("basic")!;

  it("fits when the household is no bigger than the plan", () => {
    expect(tooBigFor(standard, { profiles: 5, offlineDevices: 10 })).toEqual([]);
    expect(tooBigFor(planById.get("premium")!, { profiles: 12, offlineDevices: 24 })).toEqual([]);
  });

  it("says how many profiles and offline devices have to go, as the checkout function does", () => {
    expect(tooBigFor(standard, { profiles: 8, offlineDevices: 12 })).toEqual([
      "Standard has room for 5 profiles and your household has 8. Remove 3 in Who's reading? first.",
      "Standard keeps books offline on 10 devices and 12 are saving books now. Free 2 in Account first.",
    ]);
    expect(tooBigFor(basic, { profiles: 2, offlineDevices: 1 })).toEqual([
      "Basic has room for 1 profile and your household has 2. Remove 1 in Who's reading? first.",
    ]);
    expect(tooBigFor(basic, { profiles: 1, offlineDevices: 3 })).toEqual([
      "Basic keeps books offline on 1 device and 3 are saving books now. Free 2 in Account first.",
    ]);
  });
});
