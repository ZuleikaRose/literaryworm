import { describe, expect, it } from "@jest/globals";
import { connectionAllows, DEFAULT_SCHEDULE, knowsConnectionType, parseSchedule, schedulePath, schedulePlan } from "./offlineSchedule";

describe("schedulePlan", () => {
  it("downloads the chapter playing and the next ones that aren't saved yet", () => {
    expect(schedulePlan({ ...DEFAULT_SCHEDULE, chapters: 3 }, 4, 20, new Set([5]))).toEqual({ download: [4, 6], remove: [] });
  });

  it("stops at the end of the book", () => {
    expect(schedulePlan({ ...DEFAULT_SCHEDULE, chapters: 5 }, 18, 20, new Set())).toEqual({ download: [18, 19], remove: [] });
  });

  it("removes played chapters only when asked, and never the one playing", () => {
    const saved = new Set([0, 1, 2, 3]);
    expect(schedulePlan({ chapters: 3, wifiOnly: true, removePlayed: true }, 2, 10, saved)).toEqual({ download: [4], remove: [0, 1] });
    expect(schedulePlan({ chapters: 3, wifiOnly: true, removePlayed: false }, 2, 10, saved).remove).toEqual([]);
  });

  it("does nothing for a book with no chapters, and keeps odd places inside the book", () => {
    expect(schedulePlan(DEFAULT_SCHEDULE, 0, 0, new Set())).toEqual({ download: [], remove: [] });
    expect(schedulePlan({ ...DEFAULT_SCHEDULE, chapters: 1 }, -3, 5, new Set()).download).toEqual([0]);
    expect(schedulePlan({ ...DEFAULT_SCHEDULE, chapters: 1 }, 99, 5, new Set()).download).toEqual([4]);
  });
});

describe("connectionAllows", () => {
  it("keeps Wi-Fi only off mobile connections and treats an unknown type as Wi-Fi", () => {
    expect(connectionAllows({ type: "cellular" }, { wifiOnly: true })).toBe(false);
    expect(connectionAllows({ type: "wifi" }, { wifiOnly: true })).toBe(true);
    expect(connectionAllows({ type: "ethernet" }, { wifiOnly: true })).toBe(true);
    expect(connectionAllows(undefined, { wifiOnly: true })).toBe(true);
    expect(connectionAllows({ type: "cellular" }, { wifiOnly: false })).toBe(true);
  });

  it("never downloads with Data Saver on", () => {
    expect(connectionAllows({ type: "wifi", saveData: true }, { wifiOnly: false })).toBe(false);
  });

  it("says whether the browser tells the connection type", () => {
    expect(knowsConnectionType({ type: "wifi" })).toBe(true);
    expect(knowsConnectionType(undefined)).toBe(false);
  });
});

describe("parseSchedule", () => {
  it("accepts a saved schedule and fills in missing switches", () => {
    expect(parseSchedule({ chapters: 5, wifiOnly: false, removePlayed: true })).toEqual({ chapters: 5, wifiOnly: false, removePlayed: true });
    expect(parseSchedule({ chapters: 3 })).toEqual({ chapters: 3, wifiOnly: true, removePlayed: false });
  });

  it("refuses anything that isn't one", () => {
    for (const bad of [null, undefined, "3", { chapters: 0 }, { chapters: 11 }, { chapters: 2.5 }, { chapters: "3" }]) expect(parseSchedule(bad)).toBeNull();
  });

  it("keeps book ids safe in the cache path", () => {
    expect(schedulePath("pride-and-prejudice")).toBe("/__lw/schedule/pride-and-prejudice.json");
    expect(schedulePath("a/b")).toBe("/__lw/schedule/a%2Fb.json");
  });
});
