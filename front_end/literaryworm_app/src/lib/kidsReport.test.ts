import { describe, expect, it } from "@jest/globals";
import { groupKids, kidGroup, kidWeek, lastSevenDays, weeklyGoal, quizWeek } from "./kidsReport";

describe("a Kids profile's week", () => {
  it("covers the 7 days up to today, across a month's end", () => {
    expect(lastSevenDays("2026-11-02")).toEqual(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-29", "2026-10-28", "2026-10-27"]);
  });

  it("adds up time, listening, days read and books finished, leaving out older days", () => {
    const week = kidWeek(
      {
        "2026-11-02": { seconds: 1200, finished: 1, listened: 600, books: ["frankenstein"] },
        "2026-10-30": { seconds: 30, finished: 0 },
        "2026-10-28": { seconds: 900, finished: 1, books: ["frankenstein", "dracula"] },
        "2026-10-26": { seconds: 5000, finished: 3 },
      },
      "2026-11-02",
    );
    // Half a minute isn't a day read; the 26th is older than a week.
    expect(week).toEqual({ seconds: 2130, listened: 600, daysRead: 2, finished: 2, books: ["frankenstein", "dracula"] });
  });

  it("is empty for a profile that hasn't read", () => {
    expect(kidWeek({}, "2026-11-02")).toEqual({ seconds: 0, listened: 0, daysRead: 0, finished: 0, books: [] });
  });
});

describe("a Kids profile's weekly goal", () => {
  const days = {
    "2026-10-30": { seconds: 45 * 60, finished: 0 },
    "2026-10-25": { seconds: 30 * 60, finished: 0 },
    // Eight days ago: outside the week.
    "2026-10-22": { seconds: 600 * 60, finished: 0 },
  };

  it("counts the last 7 days against the goal", () => {
    expect(weeklyGoal(days, 120, "2026-10-30")).toEqual({ minutes: 75, goal: 120, reached: false, left: 45 });
    expect(weeklyGoal(days, 60, "2026-10-30")).toEqual({ minutes: 75, goal: 60, reached: true, left: 0 });
  });

  it("is nothing without a goal", () => {
    expect(weeklyGoal(days, null, "2026-10-30")).toBeNull();
  });
});

describe("grouping a big household's report", () => {
  const goal = (minutes: number, of: number) => ({ minutes, goal: of, reached: minutes >= of, left: Math.max(of - minutes, 0) });

  it("puts each week in a group: goal still to go, no reading, reading without a goal, goal reached", () => {
    expect(kidGroup(0, goal(0, 60))).toBe("toGo");
    expect(kidGroup(1800, goal(30, 60))).toBe("toGo");
    expect(kidGroup(3600, goal(60, 60))).toBe("reached");
    expect(kidGroup(59, null)).toBe("notYet");
    expect(kidGroup(600, null)).toBe("reading");
  });

  it("lists the groups in order, keeps each kid's order, and leaves out empty groups", () => {
    const kids = [
      { name: "Mia", group: "reached" as const },
      { name: "Leo", group: "toGo" as const },
      { name: "Ava", group: "reached" as const },
      { name: "Kai", group: "notYet" as const },
    ];
    expect(groupKids(kids, (k) => k.group).map((g) => [g.heading, g.kids.map((k) => k.name)])).toEqual([
      ["Still working on their goal", ["Leo"]],
      ["No reading yet", ["Kai"]],
      ["Goal reached", ["Mia", "Ava"]],
    ]);
    expect(groupKids([], () => "reading")).toEqual([]);
  });
});

describe("quizWeek", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
  const result = (takenAt: number, score: number, outOf = 4) => ({ bookId: "alice-in-wonderland", chapterIndex: 0, score, outOf, takenAt });

  it("adds up the quizzes from the last 7 days", () => {
    expect(quizWeek([result(at(2026, 10, 30), 3), result(at(2026, 10, 25), 4), result(at(2026, 10, 1), 0)], "2026-10-31")).toEqual({ taken: 2, right: 7, of: 8 });
  });

  it("is null with no quizzes this week", () => {
    expect(quizWeek([], "2026-10-31")).toBeNull();
    expect(quizWeek([result(at(2026, 9, 1), 2)], "2026-10-31")).toBeNull();
  });
});
