import { describe, expect, it } from "@jest/globals";
import { clock, isRunning, isSprintMinutes, pagesToSave, rankReaders, scopeKey, secondsLeft, type Sprint, totalPages } from "./sprints";
import { clearCount, countPage, joinCount, sprintCount } from "./sprintCounter";

const sprint: Sprint = { id: "s1", clubId: null, minutes: 15, startsAt: 1_000_000, endsAt: 1_000_000 + 15 * 60_000 };

describe("reading sprints", () => {
  it("offers 15, 20, 25 or 30 minutes", () => {
    expect([15, 20, 25, 30].every(isSprintMinutes)).toBe(true);
    expect(isSprintMinutes(45)).toBe(false);
  });

  it("runs from its start to its end", () => {
    expect(isRunning(sprint, sprint.startsAt)).toBe(true);
    expect(isRunning(sprint, sprint.endsAt - 1)).toBe(true);
    expect(isRunning(sprint, sprint.endsAt)).toBe(false);
    expect(isRunning(null, sprint.startsAt)).toBe(false);
  });

  it("counts the seconds left down to 0, shown as a timer", () => {
    expect(secondsLeft(sprint, sprint.startsAt)).toBe(900);
    expect(secondsLeft(sprint, sprint.endsAt - 1500)).toBe(2);
    expect(secondsLeft(sprint, sprint.endsAt + 5000)).toBe(0);
    expect(clock(900)).toBe("15:00");
    expect(clock(9)).toBe("0:09");
    expect(clock(-3)).toBe("0:00");
  });

  it("saves whole pages from 0 to 2,000", () => {
    expect(pagesToSave(12.4)).toBe(12);
    expect(pagesToSave(-2)).toBe(0);
    expect(pagesToSave(5000)).toBe(2000);
    expect(pagesToSave(Number.NaN)).toBe(0);
  });

  it("ranks readers by pages, still-to-save last, then by name", () => {
    const readers = [
      { profileId: "a", name: "Zoe", pages: 4, finished: true, mine: false },
      { profileId: "b", name: "Ann", pages: null, finished: false, mine: true },
      { profileId: "c", name: "Ben", pages: 9, finished: true, mine: false },
      { profileId: "d", name: "Ada", pages: 4, finished: true, mine: false },
    ];
    expect(rankReaders(readers).map((r) => r.name)).toEqual(["Ben", "Ada", "Zoe", "Ann"]);
    expect(totalPages(readers)).toBe(17);
  });

  it("keeps a household's and each club's sprints apart", () => {
    expect(scopeKey({ kind: "household" })).toBe("household");
    expect(scopeKey({ kind: "club", clubId: "c1" })).toBe("club:c1");
  });
});

describe("the page count on this device", () => {
  it("counts pages for the profile in the sprint while it runs", () => {
    joinCount("s1", "p1", 2_000);
    countPage("p1", 1_000);
    countPage("p1", 1_500);
    countPage("p2", 1_500); // another profile on this device
    countPage("p1", 2_000); // after the end
    expect(sprintCount()?.pages).toBe(2);
    // Joining the same sprint again keeps the count.
    joinCount("s1", "p1", 2_000);
    expect(sprintCount()?.pages).toBe(2);
    clearCount("other");
    expect(sprintCount()).not.toBeNull();
    clearCount("s1");
    expect(sprintCount()).toBeNull();
    countPage("p1", 1_000);
    expect(sprintCount()).toBeNull();
  });
});
