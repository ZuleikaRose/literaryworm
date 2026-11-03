/**
 * Refer a friend: a member's link carries their code (/signup?ref=CODE). A friend who signs up with
 * it gets a month of their plan free after their first payment, and so does the member who invited
 * them, up to REFERRAL_MONTHS_MAX months in all. The months are credits on each Stripe account,
 * added by stripe-webhook (migration 6657 holds the same rules).
 */

/** The most free months a member earns from inviting friends (claim_referral_reward() checks it too). */
export const REFERRAL_MONTHS_MAX = 2;

/** Codes are 8 letters and digits, without 0, O, 1 or I so they're easy to read out. */
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** A code from a link, tidied (case and spaces), or null when it can't be one. */
export function cleanReferralCode(input: string | null | undefined): string | null {
  const code = (input ?? "").trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/** The link a member shares. */
export const referralLink = (code: string, origin = typeof window === "undefined" ? "https://www.literaryworm.com" : window.location.origin) =>
  `${origin}/signup?ref=${encodeURIComponent(code)}`;

/** Months still to earn from inviting (0 once the limit is reached). */
export const monthsLeftToEarn = (earned: number) => Math.max(0, REFERRAL_MONTHS_MAX - Math.max(0, earned));
