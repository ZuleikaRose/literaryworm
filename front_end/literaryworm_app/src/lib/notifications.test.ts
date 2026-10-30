import { describe, expect, it } from "@jest/globals";
import type { Progress, Reminder } from "../types";
import type { Club, ClubMembership } from "./clubs";
import { badgeText, bellCount, bellLabel, clubNews, isNewRelease, releasedReminders } from "./notifications";

const now = new Date(2026, 9, 30, 12);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const reminder = (title: string, releaseDate: string): Reminder => ({ bookId: title, title, author: null, releaseDate });

describe("isNewRelease", () => {
  it("is new when out and the bell was never opened", () => {
    expect(isNewRelease(reminder("A", "2026-10-30"), null, now)).toBe(true);
  });

  it("is never new before the release day", () => {
    expect(isNewRelease(reminder("A", "2026-10-31"), null, now)).toBe(false);
  });

  it("is new when it came out after the day the bell was last opened", () => {
    expect(isNewRelease(reminder("A", "2026-10-30"), at(2026, 10, 29), now)).toBe(true);
  });

  it("isn't new once the bell was opened on or after the release day", () => {
    expect(isNewRelease(reminder("A", "2026-10-30"), at(2026, 10, 30, 8), now)).toBe(false);
    expect(isNewRelease(reminder("A", "2026-10-28"), at(2026, 10, 29), now)).toBe(false);
  });
});

it("lists released reminders newest first, leaving out the rest", () => {
  const list = releasedReminders([reminder("Old", "2026-01-01"), reminder("Soon", "2027-01-01"), reminder("New", "2026-10-30")], now);
  expect(list.map((r) => r.title)).toEqual(["New", "Old"]);
  expect(releasedReminders([], now)).toEqual([]);
});

describe("clubNews", () => {
  const club = (id: string, bookId: string): Club => ({ id, name: `Club ${id}`, bookId, startsOn: "2026-10-01", finishesOn: "2026-12-01", inviteCode: "x", ownerId: "o", memberCount: 2 });
  const membership = (unread: Record<number, number>, notify = true): ClubMembership => ({ notify, unread });

  it("counts posts up to the reader's chapter only", () => {
    const progress: Progress = { bookId: "pride-and-prejudice", format: "ebook", fraction: 0.1, chapterIndex: 3, updatedAt: 0, finished: false };
    const news = clubNews([club("a", "pride-and-prejudice")], { a: membership({ 0: 2, 3: 1, 9: 5 }) }, { "pride-and-prejudice": progress });
    expect(news).toEqual([{ clubId: "a", clubName: "Club a", bookTitle: "Pride and Prejudice", posts: 3 }]);
  });

  it("counts only chapter 1 for a reader who hasn't started", () => {
    expect(clubNews([club("a", "dune")], { a: membership({ 0: 1, 1: 4 }) }, {})[0].posts).toBe(1);
  });

  it("leaves out clubs with alerts off, nothing new, no membership or an unknown book", () => {
    const clubs = [club("off", "dune"), club("none", "dune"), club("gone", "dune"), club("odd", "no-such-book")];
    const memberships = { off: membership({ 0: 3 }, false), none: membership({}), odd: membership({ 0: 1 }) };
    expect(clubNews(clubs, memberships, {})).toEqual([]);
  });

  it("puts the busiest club first", () => {
    const news = clubNews([club("a", "dune"), club("b", "dune")], { a: membership({ 0: 1 }), b: membership({ 0: 4 }) }, {});
    expect(news.map((n) => n.clubId)).toEqual(["b", "a"]);
  });
});

describe("the bell", () => {
  it("adds new releases and club posts", () => {
    const reminders = [reminder("New", "2026-10-30"), reminder("Seen", "2026-10-01"), reminder("Soon", "2027-01-01")];
    const news = [{ clubId: "a", clubName: "A", bookTitle: "Dune", posts: 2 }];
    expect(bellCount(reminders, at(2026, 10, 15), news, now)).toBe(3);
    expect(bellCount([], null, [], now)).toBe(0);
  });

  it("caps the badge and names the button", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(3)).toBe("Notifications, 3 new");
  });
});
