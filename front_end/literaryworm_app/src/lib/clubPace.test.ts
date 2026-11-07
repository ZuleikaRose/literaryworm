import { describe, expect, it } from "@jest/globals";
import { paceLeader, paceTally, withPaceVote } from "./clubPace";

describe("club pace votes", () => {
  it("counts votes per pace, most first, a tie to the slower pace", () => {
    expect(paceTally({ a: 6, b: 4, c: 6, d: 2 })).toEqual([
      { perWeek: 6, votes: 2 },
      { perWeek: 2, votes: 1 },
      { perWeek: 4, votes: 1 },
    ]);
    expect(paceLeader({ a: 6, b: 4 })).toBe(4);
    expect(paceLeader({})).toBeNull();
  });

  it("sets, changes and takes back a member's vote", () => {
    let votes = withPaceVote({}, "me", 3);
    votes = withPaceVote(votes, "me", 5);
    expect(votes).toEqual({ me: 5 });
    expect(withPaceVote(votes, "me", null)).toEqual({});
  });
});
