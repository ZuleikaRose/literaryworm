import { describe, expect, it } from "@jest/globals";
import { type ClubPoll, leader, pollAlerts, pollError, pollOptionLabel, tally } from "./clubPolls";

const poll = (over: Partial<ClubPoll> = {}): ClubPoll => ({
  id: "p",
  clubId: "c",
  createdBy: "owner",
  question: "What next?",
  options: ["dracula", "emma", "frankenstein"],
  createdAt: 1000,
  closedAt: null,
  winner: null,
  votes: {},
  ...over,
});

describe("club polls", () => {
  it("count the votes for each book", () => {
    expect(tally(poll({ votes: { a: 1, b: 1, c: 2 } }))).toEqual([0, 2, 1]);
    expect(tally(poll())).toEqual([0, 0, 0]);
  });

  it("put the most-voted book ahead, a tie going to the one offered first, and keep a winner", () => {
    expect(leader(poll({ votes: { a: 1, b: 2, c: 2 } }))).toBe("frankenstein");
    expect(leader(poll({ votes: { a: 2, b: 1 } }))).toBe("emma");
    expect(leader(poll())).toBe("dracula");
    expect(leader(poll({ winner: "dracula", votes: { a: 1 } }))).toBe("dracula");
  });

  it("check a new poll like the database", () => {
    expect(pollError("What next?", ["a", "b"])).toBeNull();
    expect(pollError("  ", ["a", "b"])).toMatch(/question/);
    expect(pollError("x".repeat(121), ["a", "b"])).toMatch(/120/);
    expect(pollError("Q", ["a"])).toMatch(/at least 2/);
    expect(pollError("Q", ["a", "b", "c", "d", "e", "f"])).toMatch(/up to 5/);
    expect(pollError("Q", ["a", "a"])).toMatch(/once/);
  });

  it("alert about open polls a member didn't start or answer, in clubs with alerts on, newest first", () => {
    const polls = [
      poll({ id: "1", createdAt: 10 }),
      poll({ id: "2", createdAt: 20 }),
      poll({ id: "mine", createdBy: "me" }),
      poll({ id: "voted", votes: { me: 0 } }),
      poll({ id: "closed", closedAt: 5, winner: "emma" }),
      poll({ id: "quiet", clubId: "muted" }),
    ];
    const alerts = pollAlerts(polls, (c) => c === "muted", "me", () => "Sunday Classics");
    expect(alerts.map((a) => a.poll.id)).toEqual(["2", "1"]);
    expect(alerts[0]).toMatchObject({ clubName: "Sunday Classics", at: 20 });
  });
});

describe("poll options from uploads", () => {
  it("names an upload by the title and author the poll keeps, a catalog book by the catalog", () => {
    const poll = { uploadLabels: { "u-0123456789abcdef0123456789abcdef": { title: "My Book", author: "Me" } } };
    const catalog = (id: string) => (id === "dune" ? { title: "Dune", author: "Frank Herbert" } : undefined);
    expect(pollOptionLabel(poll, "u-0123456789abcdef0123456789abcdef", catalog)).toEqual({ title: "My Book", author: "Me" });
    expect(pollOptionLabel(poll, "dune", catalog)).toEqual({ title: "Dune", author: "Frank Herbert" });
    expect(pollOptionLabel({}, "nope", catalog)).toBeNull();
  });
});
