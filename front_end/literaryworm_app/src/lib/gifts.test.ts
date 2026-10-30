import { describe, expect, it } from "@jest/globals";
import { giftPriceCents } from "./gifts";

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
