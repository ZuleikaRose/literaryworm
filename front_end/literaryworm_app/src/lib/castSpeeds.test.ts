import { describe, expect, it } from "@jest/globals";
import { CAST_SPEED_BOOKS_MAX, parseAllCastSpeeds, speakerRate, withCastSpeed } from "./castSpeeds";

describe("a speed for each character", () => {
  it("sets and clears one speaker's speed in one book", () => {
    let all = withCastSpeed(undefined, "u-1", " Juno ", 1.2);
    expect(all).toEqual({ "u-1": { juno: 1.2 } });
    all = withCastSpeed(all, "u-1", "Ezra", 0.8);
    expect(speakerRate(all["u-1"], "EZRA")).toBe(0.8);
    expect(speakerRate(all["u-1"], "Narrator")).toBe(1);
    expect(speakerRate(all["u-1"], null)).toBe(1);
    all = withCastSpeed(all, "u-1", "juno", null);
    expect(all).toEqual({ "u-1": { ezra: 0.8 } });
    // Only the offered speeds.
    expect(withCastSpeed(all, "u-1", "ezra", 3)).toEqual({});
  });

  it("keeps the newest books only, and reads back only what's valid", () => {
    let all = {};
    for (let i = 0; i < CAST_SPEED_BOOKS_MAX + 5; i++) all = withCastSpeed(all, `b${i}`, "a", 1.1);
    expect(Object.keys(all)).toHaveLength(CAST_SPEED_BOOKS_MAX);
    expect(Object.keys(all)[0]).toBe("b5");
    expect(parseAllCastSpeeds({ x: { juno: 1.2, ezra: 9, "": 0.8 }, y: [], z: "no" })).toEqual({ x: { juno: 1.2 } });
    expect(parseAllCastSpeeds(null)).toEqual({});
  });
});
