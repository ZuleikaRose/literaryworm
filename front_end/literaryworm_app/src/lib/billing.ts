/** Billing dates, amounts and promo codes, shown on Plans and Account. */

import type { Account, BillingInterval } from "../types";
import type { MembershipDiscount } from "./accountApi";

/** 1 → "1st", 22 → "22nd". */
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** The next time a plan billed on `day` (1–28) renews, after `from`. */
export function nextBillingDate(day: number, from = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth(), day);
  if (next <= from) next.setMonth(next.getMonth() + 1);
  return next;
}

/** Members must cancel at least this long before the next billing date to stop that charge (the Terms). */
export const CANCEL_NOTICE_HOURS = 48;

/** The same day and time a month later; a day the next month doesn't have becomes its last day, as Stripe renews. */
export function oneMonthAfter(from: Date): Date {
  const next = new Date(from);
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(from.getDate(), lastDay));
  return next;
}

/** The same day a year later; 29 February becomes 28 February, as Stripe renews. */
export function oneYearAfter(from: Date): Date {
  const next = new Date(from);
  next.setDate(1);
  next.setFullYear(next.getFullYear() + 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(from.getDate(), lastDay));
  return next;
}

/**
 * When a membership cancelled now ends, given its next billing date (the same rule as the
 * manage-account function). With at least 48 hours' notice it ends then and nothing more is
 * charged; with less, that charge still goes through and it ends a period (a month, or a year
 * when billed yearly) later. No refunds.
 */
export function cancellationEnd(nextBilling: Date, now = new Date(), interval: BillingInterval = "month"): { ends: Date; late: boolean } {
  if (nextBilling.getTime() - now.getTime() >= CANCEL_NOTICE_HOURS * 3_600_000) return { ends: nextBilling, late: false };
  return { ends: interval === "year" ? oneYearAfter(nextBilling) : oneMonthAfter(nextBilling), late: true };
}

/** How long before a yearly renewal the bell reminds the member (the Terms promise it). */
export const RENEWAL_REMINDER_DAYS = 30;

export interface RenewalReminder {
  /** When the year renews (ISO). */
  renewsAt: string;
  /** When the reminder started showing (ms): the bell counts it as new after this. */
  at: number;
}

/**
 * The reminder that a yearly membership renews soon: from 30 days before until the day, while
 * it's set to renew (not ending, paused, on a gift or complimentary). Monthly plans get none.
 */
export function renewalReminder(
  account: Pick<Account, "billingInterval" | "renewsAt" | "endsAt" | "status" | "complimentary" | "giftUntil"> | null,
  now = Date.now(),
): RenewalReminder | null {
  if (!account || account.billingInterval !== "year" || !account.renewsAt) return null;
  if (account.endsAt || account.status !== "active" || account.complimentary || account.giftUntil) return null;
  const renews = Date.parse(account.renewsAt);
  const at = renews - RENEWAL_REMINDER_DAYS * 86_400_000;
  return now >= at && now < renews ? { renewsAt: account.renewsAt, at } : null;
}

export const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A plan's end date. The server stores it as midnight UTC on the billing day, so read the day in UTC. */
export const endDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Cents as money: 1039, "usd" → "$10.39". */
export const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/** "20% off until January 5, 2027", "$2.00 off your next charge", "10% off for as long as you're a member". */
export function discountLabel(d: MembershipDiscount): string {
  const off = d.percentOff !== null ? `${d.percentOff}% off` : `${formatMoney(d.amountOff ?? 0, d.currency ?? "usd")} off`;
  if (d.duration === "once") return `${off} your next charge`;
  if (d.duration === "repeating" && d.ends) return `${off} until ${endDate(d.ends)}`;
  return `${off} for as long as you're a member`;
}

/**
 * What the plan costs once a promo code stops applying: "Then $12.99 a month from January 5,
 * 2027." Null for a code that lasts as long as the membership.
 */
export function afterDiscountLabel(d: MembershipDiscount, price: string, interval: BillingInterval = "month"): string | null {
  const per = interval === "year" ? "a year" : "a month";
  if (d.duration === "forever") return null;
  if (d.duration === "repeating" && d.ends) return `Then ${price} ${per} from ${endDate(d.ends)}.`;
  return `Then ${price} ${per} after that.`;
}

export const PROMO_CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

/** The same check as the manage-account function. */
export function promoCodeError(code: string): string | null {
  if (!code.trim()) return "Enter a promo code.";
  return PROMO_CODE_PATTERN.test(code.trim()) ? null : "Enter the code as it was given: 3 to 40 letters, numbers, - or _.";
}
