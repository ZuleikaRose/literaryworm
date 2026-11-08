import { describe, expect, it } from "@jest/globals";
import { bookTimes, fromPortable, sessionSeconds, toPortable } from "./portablePlace";

describe("a place that carries over between copies of a book", () => {
  const mine = { starts: [0, 600, 1500], lengths: [600, 900, 300] };
  const theirs = { starts: [0, 300, 900], lengths: [300, 600, 600] };

  it("keeps the chapter and how far through it", () => {
    expect(toPortable(0, mine.starts, mine.lengths)).toBe(0);
    expect(toPortable(1050, mine.starts, mine.lengths)).toBeCloseTo(1.5);
    // Halfway through the second chapter is halfway through it in another copy too.
    expect(fromPortable(1.5, theirs.starts, theirs.lengths)).toBeCloseTo(600);
    expect(fromPortable(toPortable(1600, mine.starts, mine.lengths), mine.starts, mine.lengths)).toBeCloseTo(1600);
  });

  it("stays inside the book", () => {
    expect(toPortable(1800, mine.starts, mine.lengths)).toBeCloseTo(2.9999);
    expect(fromPortable(7.5, theirs.starts, theirs.lengths)).toBe(1500);
    expect(toPortable(10, [], [])).toBe(0);
  });
});

describe("a session's place in this copy", () => {
  it("adds the time since it was heard to this copy's seconds", () => {
    const times = bookTimes({ chapters: [{ minutes: 10 }, { minutes: 5 }] });
    expect(times).toEqual({ starts: [0, 600], lengths: [600, 300] });
    const session = { position: 1.5, playing: true, rate: 2, heardAt: 1000 };
    expect(sessionSeconds(session, times, 11_000)).toBeCloseTo(750 + 20);
    expect(sessionSeconds({ ...session, playing: false }, times, 11_000)).toBeCloseTo(750);
    expect(sessionSeconds({ ...session, position: 30 }, null, 11_000)).toBe(50);
  });
});
