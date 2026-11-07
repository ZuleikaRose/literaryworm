import { describe, expect, it } from "@jest/globals";
import { BOOK_SPEEDS_MAX, hasOwnSpeed, parseBookSpeeds, speedFor, speedPatch, withBookSpeed } from "./bookSpeed";
import { defaultPlayerSettings } from "./reading";

const player = { ...defaultPlayerSettings, speed: 1.25, bookSpeeds: { dune: 1.75 } };

describe("a speed for each book", () => {
  it("plays a book at its own speed, every other at the profile's", () => {
    expect(speedFor(player, "dune")).toBe(1.75);
    expect(speedFor(player, "emma")).toBe(1.25);
    expect(speedFor(player, null)).toBe(1.25);
    expect(hasOwnSpeed(player, "dune")).toBe(true);
    expect(hasOwnSpeed(player, "emma")).toBe(false);
  });

  it("changes only the open book's speed when it has one", () => {
    expect(speedPatch(player, "dune", 2)).toEqual({ bookSpeeds: { dune: 2 } });
    expect(speedPatch(player, "emma", 2)).toEqual({ speed: 2 });
  });

  it("keeps the newest, forgets on null, clamps, and keeps at most the limit", () => {
    expect(withBookSpeed({ a: 1, b: 1.5 }, "a", null)).toEqual({ b: 1.5 });
    expect(Object.keys(withBookSpeed({ a: 1, b: 1.5 }, "a", 2))).toEqual(["b", "a"]);
    expect(withBookSpeed({}, "a", 9)).toEqual({ a: 3 });
    const many = Object.fromEntries(Array.from({ length: BOOK_SPEEDS_MAX }, (_, i) => [`b${i}`, 1]));
    const next = withBookSpeed(many, "new", 1.5);
    expect(Object.keys(next)).toHaveLength(BOOK_SPEEDS_MAX);
    expect(next.b0).toBeUndefined();
    expect(next.new).toBe(1.5);
  });

  it("reads back only valid speeds, and handles empty input", () => {
    expect(parseBookSpeeds({ dune: 1.5, bad: 7, odd: "2", [`x`.repeat(70)]: 1 })).toEqual({ dune: 1.5 });
    expect(parseBookSpeeds(null)).toEqual({});
    expect(parseBookSpeeds([])).toEqual({});
    expect(withBookSpeed(undefined, "a", null)).toEqual({});
  });
});
