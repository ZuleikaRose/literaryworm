import { describe, expect, it } from "@jest/globals";
import {
  fromLocalInput,
  type MaintenanceNotice,
  noticeErrors,
  noticeState,
  noticeWhen,
  showingNotices,
  sortForStaff,
  toLocalInput,
  toNotice,
} from "./maintenance";

const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-01T12:00:00Z");
const notice = (id: string, announce: number, start: number, end: number): MaintenanceNotice => ({
  id,
  title: id,
  message: "m",
  announceAt: NOW + announce * H,
  startsAt: NOW + start * H,
  endsAt: NOW + end * H,
});

describe("noticeState and showingNotices", () => {
  const scheduled = notice("scheduled", 2, 10, 11);
  const announced = notice("announced", -1, 3, 4);
  const underWay = notice("underWay", -5, -1, 1);
  const over = notice("over", -10, -3, -2);

  it("knows where each notice is", () => {
    expect(noticeState(scheduled, NOW)).toBe("scheduled");
    expect(noticeState(announced, NOW)).toBe("announced");
    expect(noticeState(underWay, NOW)).toBe("under way");
    expect(noticeState(over, NOW)).toBe("over");
    // Exactly at the end, it's over; exactly at the start, it's under way.
    expect(noticeState(underWay, underWay.endsAt)).toBe("over");
    expect(noticeState(announced, announced.startsAt)).toBe("under way");
  });

  it("shows announced and under-way notices, soonest work first", () => {
    expect(showingNotices([scheduled, announced, over, underWay], NOW).map((n) => n.id)).toEqual(["underWay", "announced"]);
  });

  it("lists what's coming first for staff, then the past newest first", () => {
    const older = notice("older", -30, -25, -24);
    expect(sortForStaff([over, scheduled, older, underWay, announced], NOW).map((n) => n.id)).toEqual(["underWay", "announced", "scheduled", "over", "older"]);
  });
});

describe("noticeErrors", () => {
  const ok = { title: "Planned update", message: "You may be logged out briefly.", announceAt: NOW, startsAt: NOW + 24 * H, endsAt: NOW + 25 * H };

  it("accepts a good notice", () => {
    expect(noticeErrors(ok, NOW, { isNew: true })).toEqual({});
  });

  it("needs every field, within the lengths", () => {
    const e = noticeErrors({ title: " ", message: "", announceAt: null, startsAt: null, endsAt: null }, NOW, { isNew: true });
    expect(Object.keys(e).sort()).toEqual(["announceAt", "endsAt", "message", "startsAt", "title"]);
    expect(noticeErrors({ ...ok, title: "x".repeat(81) }, NOW, { isNew: true }).title).toMatch(/80/);
    expect(noticeErrors({ ...ok, message: "x".repeat(501) }, NOW, { isNew: true }).message).toMatch(/500/);
  });

  it("keeps the times in order and within the limits", () => {
    expect(noticeErrors({ ...ok, endsAt: ok.startsAt }, NOW, { isNew: true }).endsAt).toBe("End it after it starts.");
    expect(noticeErrors({ ...ok, endsAt: ok.startsAt + 8 * 24 * H }, NOW, { isNew: true }).endsAt).toMatch(/7 days/);
    expect(noticeErrors({ ...ok, announceAt: ok.startsAt + H }, NOW, { isNew: true }).announceAt).toMatch(/before/);
    expect(noticeErrors({ ...ok, announceAt: ok.startsAt - 31 * 24 * H }, NOW, { isNew: true }).announceAt).toMatch(/30 days/);
    expect(noticeErrors({ ...ok, announceAt: ok.startsAt }, NOW, { isNew: true })).toEqual({});
  });

  it("refuses new notices for work that's over, but lets old ones be edited", () => {
    const past = { ...ok, announceAt: NOW - 5 * H, startsAt: NOW - 3 * H, endsAt: NOW - 2 * H };
    expect(noticeErrors(past, NOW, { isNew: true }).endsAt).toMatch(/passed/);
    expect(noticeErrors(past, NOW, { isNew: false })).toEqual({});
  });
});

describe("times", () => {
  it("reads rows from the database", () => {
    expect(toNotice({ id: "a", title: "t", message: "m", announce_at: "2026-11-01T00:00:00Z", starts_at: "2026-11-02T02:00:00Z", ends_at: "2026-11-02T02:30:00Z" })).toEqual({
      id: "a",
      title: "t",
      message: "m",
      announceAt: Date.parse("2026-11-01T00:00:00Z"),
      startsAt: Date.parse("2026-11-02T02:00:00Z"),
      endsAt: Date.parse("2026-11-02T02:30:00Z"),
    });
  });

  it("round-trips the date and time inputs, which are in local time", () => {
    const local = "2026-11-02T02:00";
    expect(toLocalInput(fromLocalInput(local))).toBe(local);
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("tomorrow")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });

  it("says when the work runs, with the time zone, on one day or across two", () => {
    expect(noticeWhen({ startsAt: Date.parse("2026-11-02T02:00:00Z"), endsAt: Date.parse("2026-11-02T02:30:00Z") }, "UTC")).toBe("Mon 2 Nov, 02:00–02:30 UTC");
    expect(noticeWhen({ startsAt: Date.parse("2026-11-02T23:00:00Z"), endsAt: Date.parse("2026-11-03T01:00:00Z") }, "UTC")).toBe("Mon 2 Nov, 23:00 – Tue 3 Nov, 01:00 UTC");
    expect(noticeWhen({ startsAt: Date.parse("2026-11-02T14:00:00Z"), endsAt: Date.parse("2026-11-02T15:00:00Z") }, "America/New_York")).toBe("Mon 2 Nov, 09:00–10:00 EST");
  });
});
