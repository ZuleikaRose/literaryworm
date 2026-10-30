import { describe, expect, it } from "@jest/globals";
import type { Reminder } from "../types";
import { isOut, releaseDay, sortReminders } from "./release";

describe("releaseDay", () => {
  it("reads Google's dates at any precision", () => {
    expect(releaseDay("2027")).toBe("2027-01-01");
    expect(releaseDay("2027-03")).toBe("2027-03-01");
    expect(releaseDay("2027-03-14")).toBe("2027-03-14");
    expect(releaseDay("2027-03-14T00:00:00Z")).toBe("2027-03-14");
  });

  it("is null without a date", () => {
    expect(releaseDay(null)).toBeNull();
    expect(releaseDay("soon")).toBeNull();
    expect(releaseDay("")).toBeNull();
  });
});

describe("isOut", () => {
  const now = new Date(2026, 9, 30, 9);
  it("counts the release day itself as out", () => {
    expect(isOut("2026-10-29", now)).toBe(true);
    expect(isOut("2026-10-30", now)).toBe(true);
    expect(isOut("2026-10-31", now)).toBe(false);
  });
});

it("sorts reminders soonest first, then by title, without changing the list it was given", () => {
  const r = (title: string, releaseDate: string) => ({ title, releaseDate }) as Reminder;
  expect(sortReminders([])).toEqual([]);
  expect(sortReminders([r("A", "2027-01-01")]).map((x) => x.title)).toEqual(["A"]);
  const given = [r("B", "2027-01-01"), r("A", "2026-01-01")];
  sortReminders(given);
  expect(given.map((x) => x.title)).toEqual(["B", "A"]);
  expect(sortReminders([r("B", "2027-01-01"), r("C", "2026-12-01"), r("A", "2027-01-01")]).map((x) => x.title)).toEqual(["C", "A", "B"]);
});
