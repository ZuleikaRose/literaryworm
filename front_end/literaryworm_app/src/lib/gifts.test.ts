import { describe, expect, it } from "@jest/globals";
import { giftNotStarted, giftPriceCents, giftStartBounds, giftStartError } from "./gifts";

describe("what a gift costs", () => {
  const standard = { price: 12.99, yearlyPrice: 129.9 };

  it("is the monthly price for each month", () => {
    expect(giftPriceCents(standard, 1)).toBe(1299);
    expect(giftPriceCents(standard, 6)).toBe(7794);
  });

  it("is the yearly price for a year: two months free", () => {
    expect(giftPriceCents(standard, 12)).toBe(12990);
  });
});

describe("a gift's start day", () => {
  const now = new Date(2026, 9, 30, 15, 0);

  it("can be tomorrow up to a year ahead", () => {
    expect(giftStartBounds(now)).toEqual({ min: "2026-10-31", max: "2027-10-30" });
    expect(giftStartError("2027-03-14", now)).toBeNull();
    expect(giftStartError("", now)).toBe("Pick the day the gift starts.");
    expect(giftStartError("2026-10-30", now)).toMatch(/after today/);
    expect(giftStartError("2027-10-31", now)).toMatch(/up to a year ahead/);
  });

  it("holds the code back until the day", () => {
    expect(giftNotStarted(null, now)).toBe(false);
    expect(giftNotStarted("2026-10-31", now)).toBe(true);
    expect(giftNotStarted("2026-10-30", now)).toBe(false);
  });
});
