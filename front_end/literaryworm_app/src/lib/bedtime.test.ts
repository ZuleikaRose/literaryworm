import { describe, expect, it } from "@jest/globals";
import { bedtimeNow, inBedtime, isTime, minutesOf, nextCheckMs, timeLabel, wakesAt } from "./bedtime";

const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m, 0);
const kid = { ageRating: "kids" as const, bedtime: "20:00", wakeTime: "07:00" };

describe("bedtime", () => {
  it("reads and writes times", () => {
    expect(isTime("20:30")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("8:30")).toBe(false);
    expect(minutesOf("20:30")).toBe(1230);
    expect(["20:30", "07:00", "00:00", "12:00", "12:15"].map(timeLabel)).toEqual(["8:30pm", "7am", "12am", "12pm", "12:15pm"]);
  });

  it("is bedtime overnight, from bedtime until wake-up", () => {
    expect(inBedtime(at(19, 59), "20:00", "07:00")).toBe(false);
    expect(inBedtime(at(20, 0), "20:00", "07:00")).toBe(true);
    expect(inBedtime(at(2), "20:00", "07:00")).toBe(true);
    expect(inBedtime(at(6, 59), "20:00", "07:00")).toBe(true);
    expect(inBedtime(at(7, 0), "20:00", "07:00")).toBe(false);
    expect(inBedtime(at(12), "20:00", "07:00")).toBe(false);
  });

  it("handles a window that doesn't cross midnight, and an empty one", () => {
    expect(inBedtime(at(1), "00:30", "06:00")).toBe(true);
    expect(inBedtime(at(23), "00:30", "06:00")).toBe(false);
    expect(inBedtime(at(20), "20:00", "20:00")).toBe(false);
  });

  it("wakes at the next wake-up time", () => {
    expect(wakesAt(at(21), "07:00")).toEqual(new Date(2026, 10, 2, 7, 0, 0));
    expect(wakesAt(at(5), "07:00")).toEqual(new Date(2026, 10, 1, 7, 0, 0));
  });

  it("applies only to Kids profiles with a bedtime, and not while a grown-up allowed more", () => {
    expect(bedtimeNow(kid, at(21))).toBe(true);
    expect(bedtimeNow({ ...kid, ageRating: "teen" }, at(21))).toBe(false);
    expect(bedtimeNow({ ...kid, bedtime: null }, at(21))).toBe(false);
    expect(bedtimeNow(null, at(21))).toBe(false);
    expect(bedtimeNow(kid, at(21), at(21, 15).getTime())).toBe(false);
    expect(bedtimeNow(kid, at(21, 20), at(21, 15).getTime())).toBe(true);
  });

  it("checks again at the next minute", () => {
    expect(nextCheckMs(new Date(2026, 10, 1, 20, 0, 30, 0))).toBe(30_050);
  });
});
