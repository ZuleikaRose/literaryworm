import { describe, expect, it } from "@jest/globals";
import type { MembershipDiscount } from "./accountApi";
import { afterDiscountLabel, cancellationEnd, CANCEL_NOTICE_HOURS, oneMonthAfter, oneYearAfter, renewalReminder } from "./billing";
import { perPeriod, plans, priceFor } from "../data/plans";

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

describe("yearly billing", () => {
  it("renews a year on, with 29 February becoming the 28th", () => {
    expect(oneYearAfter(new Date(2027, 2, 10)).toDateString()).toBe(new Date(2028, 2, 10).toDateString());
    expect(oneYearAfter(new Date(2028, 1, 29)).toDateString()).toBe(new Date(2029, 1, 28).toDateString());
  });

  it("ends a late yearly cancellation a year after the renewal, and an early one at it", () => {
    const renewal = new Date(2027, 2, 10);
    expect(cancellationEnd(renewal, new Date(2027, 2, 9), "year")).toEqual({ ends: new Date(2028, 2, 10), late: true });
    expect(cancellationEnd(renewal, new Date(2027, 2, 1), "year")).toEqual({ ends: renewal, late: false });
  });

  it("prices a year at ten months, so two months are free", () => {
    for (const plan of plans) {
      expect(priceFor(plan, "year")).toBeCloseTo(plan.price * 10, 2);
      expect(priceFor(plan, "month")).toBe(plan.price);
    }
    expect(perPeriod("year")).toBe("a year");
  });

  it("says what a yearly price becomes once a promo code ends", () => {
    const code = { code: "X", percentOff: 10, amountOff: null, currency: null, duration: "once" as const, ends: null };
    expect(afterDiscountLabel(code, "$79.90", "year")).toBe("Then $79.90 a year after that.");
  });
});

describe("the yearly renewal reminder", () => {
  const yearly = {
    billingInterval: "year" as const,
    renewsAt: "2027-03-10T00:00:00.000Z",
    endsAt: null,
    status: "active" as const,
    complimentary: false,
    giftUntil: null,
    switchToMonthly: null,
  };
  const day = 86_400_000;
  const renews = Date.parse(yearly.renewsAt);

  it("shows from 30 days before the renewal until the day", () => {
    expect(renewalReminder(yearly, renews - 31 * day)).toBeNull();
    expect(renewalReminder(yearly, renews - 30 * day)).toEqual({ renewsAt: yearly.renewsAt, at: renews - 30 * day, switchToMonthly: null });
    expect(renewalReminder(yearly, renews - day)).not.toBeNull();
    expect(renewalReminder(yearly, renews)).toBeNull();
  });

  it("says when the renewal moves to monthly billing instead", () => {
    expect(renewalReminder({ ...yearly, switchToMonthly: "basic" }, renews - day)?.switchToMonthly).toBe("basic");
  });

  it("isn't shown for monthly, ending, paused, gifted or complimentary memberships", () => {
    const now = renews - 5 * day;
    for (const patch of [
      { billingInterval: "month" as const },
      { endsAt: yearly.renewsAt },
      { status: "paused" as const },
      { giftUntil: yearly.renewsAt },
      { complimentary: true },
    ]) {
      expect(renewalReminder({ ...yearly, ...patch }, now)).toBeNull();
    }
  });
});
