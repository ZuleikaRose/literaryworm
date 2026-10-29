/** Billing dates, amounts and promo codes, shown on Plans and Account. */

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

export const PROMO_CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

/** The same check as the manage-account function. */
export function promoCodeError(code: string): string | null {
  if (!code.trim()) return "Enter a promo code.";
  return PROMO_CODE_PATTERN.test(code.trim()) ? null : "Enter the code as it was given: 3 to 40 letters, numbers, - or _.";
}
