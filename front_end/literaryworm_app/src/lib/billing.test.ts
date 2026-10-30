import { describe, expect, it } from "@jest/globals";
import type { MembershipDiscount } from "./accountApi";
import { afterDiscountLabel, cancellationEnd, CANCEL_NOTICE_HOURS, oneMonthAfter } from "./billing";

describe("the 48-hour cancellation rule", () => {
  const billing = new Date(2026, 10, 5, 0, 0);
  const hoursBefore = (h: number) => new Date(billing.getTime() - h * 3_600_000);

  it("ends on the billing date with 48 hours' notice or more", () => {
    expect(CANCEL_NOTICE_HOURS).toBe(48);
    expect(cancellationEnd(billing, hoursBefore(72))).toEqual({ ends: billing, late: false });
    expect(cancellationEnd(billing, hoursBefore(48))).toEqual({ ends: billing, late: false });
  });

  it("keeps the next charge and ends a month later with less", () => {
    const late = cancellationEnd(billing, hoursBefore(47.9));
    expect(late.late).toBe(true);
    expect(late.ends).toEqual(new Date(2026, 11, 5, 0, 0));
    expect(cancellationEnd(billing, hoursBefore(1)).late).toBe(true);
  });

  it("moves a month on, clamping to the last day of a shorter month", () => {
    expect(oneMonthAfter(new Date(2026, 11, 18, 9, 30))).toEqual(new Date(2027, 0, 18, 9, 30));
    expect(oneMonthAfter(new Date(2027, 0, 31))).toEqual(new Date(2027, 1, 28));
    expect(oneMonthAfter(new Date(2028, 0, 31))).toEqual(new Date(2028, 1, 29));
  });
});

describe("the price after a promo code", () => {
  const code = (over: Partial<MembershipDiscount>): MembershipDiscount => ({
    code: "SPRING20",
    percentOff: 20,
    amountOff: null,
    currency: null,
    duration: "repeating",
    ends: "2027-01-05T00:00:00.000Z",
    ...over,
  });

  it("says when the full price starts for a code with an end date", () => {
    expect(afterDiscountLabel(code({}), "$12.99")).toBe("Then $12.99 a month from January 5, 2027.");
  });

  it("says the full price follows a one-off code", () => {
    expect(afterDiscountLabel(code({ duration: "once", ends: null }), "$12.99")).toBe("Then $12.99 a month after that.");
  });

  it("says nothing for a code that lasts as long as the membership", () => {
    expect(afterDiscountLabel(code({ duration: "forever", ends: null }), "$12.99")).toBeNull();
  });
});
