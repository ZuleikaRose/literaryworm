import { describe, expect, it } from "@jest/globals";
import { combinedLeft, shareLeft } from "./profileShares";

describe("a profile's share of the household's hours", () => {
  it("counts down from its minutes, never below zero", () => {
    expect(shareLeft(null, 100)).toBeNull();
    expect(shareLeft(60, 1800)).toBe(1800);
    expect(shareLeft(60, 9999)).toBe(0);
  });

  it("stops at whichever runs out first, and says which", () => {
    expect(combinedLeft(null, null)).toEqual({ left: null, byShare: false });
    expect(combinedLeft(5000, null)).toEqual({ left: 5000, byShare: false });
    expect(combinedLeft(5000, 1000)).toEqual({ left: 1000, byShare: true });
    expect(combinedLeft(500, 1000)).toEqual({ left: 500, byShare: false });
    expect(combinedLeft(null, 0)).toEqual({ left: 0, byShare: true });
  });
});
