/**
 * Refer a friend: a member's link carries their code (/signup?ref=CODE). When a friend signs up with
 * it and makes their first payment, each of them gets 20% off one month of their own plan as a credit
 * on their Stripe account, added by stripe-webhook: the friend once, and the member who invited them
 * once per account, however many friends join. Migration 6843 holds the same rules
 * (claim_referral_reward(), private.referral_credit_cents()); this file is their mirror, for the app
 * and the tests.
 *
 * Until 2026-11-23 the reward was a free month each, up to 2 for inviting. Referrals whose reward was
 * claimed before the change keep that rule (`reward_rule` 'free_month'); every other one is 'percent_20'.
 */

/** The share of one month of a member's own plan that each side is credited. */
export const REFERRAL_SHARE_PERCENT = 20;

/** How many free months the old offer let a member earn for inviting (only 'free_month' referrals). */
export const OLD_REFERRAL_MONTHS_MAX = 2;

/** Which offer a referral follows (referrals.reward_rule). */
export type ReferralRule = "free_month" | "percent_20";

export type BillingInterval = "month" | "year";

/** A plan's prices in cents (plans.price_cents and plans.yearly_price_cents). */
export interface PlanPrices {
  monthlyCents: number | null | undefined;
  yearlyCents: number | null | undefined;
}

const MONTHS_IN_YEAR = 12;
const PERCENT = 100;

/** n / d rounded half up, for whole cents (n ≥ 0, d > 0), in whole numbers so it matches the database. */
const roundedDivide = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));

/** A credit rounds to whole cents; one that rounds to nothing is no credit. */
const credit = (cents: number) => (cents > 0 ? cents : null);

const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * 20% of one month of a plan, in cents, rounded half up. Monthly billing: 20% of the monthly price.
 * Yearly billing: 20% of a twelfth of the yearly price (one month's share of what the member pays),
 * or of the monthly price when the yearly one is missing. Null when there's no price, or it rounds to 0.
 */
export function referralCreditCents(prices: PlanPrices | null | undefined, interval: BillingInterval | null | undefined): number | null {
  if (!prices) return null;
  if (interval === "year" && positive(prices.yearlyCents)) {
    return credit(roundedDivide(Math.round(prices.yearlyCents) * REFERRAL_SHARE_PERCENT, MONTHS_IN_YEAR * PERCENT));
  }
  if (positive(prices.monthlyCents)) return credit(roundedDivide(Math.round(prices.monthlyCents) * REFERRAL_SHARE_PERCENT, PERCENT));
  return null;
}

/** What one side of a referral is worth under its rule: the old free month is the monthly price. */
export function referralSideCents(rule: ReferralRule, prices: PlanPrices | null | undefined, interval: BillingInterval | null | undefined): number | null {
  if (rule === "free_month") return prices && positive(prices.monthlyCents) ? Math.round(prices.monthlyCents) : null;
  return referralCreditCents(prices, interval);
}

/** One side of a referral, and the paid membership it can be credited on. */
export interface Member {
  id: string;
  staff: boolean;
  /** The plan's prices and billing, or null without a paid membership. */
  plan: (PlanPrices & { interval: BillingInterval }) | null;
}

/** The inviter's earlier credits, from their other referrals. */
export interface InviterHistory {
  /** Free months credited under the old offer. */
  freeMonths: number;
  /** Whether the one 20% inviting credit has been added. */
  hasPercentCredit: boolean;
}

export type ReferrerSkipped = "staff" | "no_membership" | "limit_reached" | "already_credited" | "self";

export interface ReferralRewardResult {
  /** Null: nothing for the friend (yet, without a paid membership; never, when closed). */
  friendCents: number | null;
  referrerCents: number | null;
  referrerSkipped: ReferrerSkipped | null;
}

/**
 * What a referral gives when the invited friend's first payment goes through, as
 * claim_referral_reward() decides it. Each referral is claimed once (the database keeps that).
 */
export function referralReward(rule: ReferralRule, friend: Member, inviter: Member, history: InviterHistory): ReferralRewardResult {
  // The database refuses a referral to yourself, and the sign-up trigger never makes one.
  if (friend.id === inviter.id) return { friendCents: null, referrerCents: null, referrerSkipped: "self" };
  // Staff are never billed, so an invited staff member isn't rewarded, and neither is their inviter.
  if (friend.staff) return { friendCents: null, referrerCents: null, referrerSkipped: "staff" };
  const friendCents = friend.plan ? referralSideCents(rule, friend.plan, friend.plan.interval) : null;
  if (friendCents === null) return { friendCents: null, referrerCents: null, referrerSkipped: null };
  const skip = (why: ReferrerSkipped): ReferralRewardResult => ({ friendCents, referrerCents: null, referrerSkipped: why });
  if (inviter.staff) return skip("staff");
  if (rule === "free_month" && history.freeMonths >= OLD_REFERRAL_MONTHS_MAX) return skip("limit_reached");
  if (rule === "percent_20" && history.hasPercentCredit) return skip("already_credited");
  const referrerCents = inviter.plan ? referralSideCents(rule, inviter.plan, inviter.plan.interval) : null;
  if (referrerCents === null) return skip("no_membership");
  return { friendCents, referrerCents, referrerSkipped: null };
}

/**
 * The rule a referral follows at the cut-over: one already rewarded keeps the free month, every other
 * one (and every new one) is 20%. Migration 6843 stamps the same.
 */
export const ruleAtCutover = (rewardedAt: string | null | undefined): ReferralRule => (rewardedAt ? "free_month" : "percent_20");

/** Where the inviter's one 20% credit stands, for Account. */
export type InviterCredit = "earned" | "pending" | "none";

/** Earned once it's added; pending while a friend who signed up hasn't paid yet; otherwise none. */
export function inviterCredit(creditCents: number | null | undefined, waiting: number | null | undefined): InviterCredit {
  if (positive(creditCents)) return "earned";
  return positive(waiting) ? "pending" : "none";
}

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
