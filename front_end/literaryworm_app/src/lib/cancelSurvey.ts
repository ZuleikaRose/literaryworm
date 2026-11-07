import type { BillingInterval, PlanId } from "../types";
import { tk } from "./i18n";

/**
 * Why a member is leaving, asked when they cancel, and what we offer before they go.
 * The reasons and offers match supabase/functions/_shared/cancelReasons.ts and the checks on
 * public.cancellation_feedback (cancelSurvey.test.ts checks); the answer is optional.
 */

export const CANCEL_REASONS = [
  "too_expensive",
  "not_enough_time",
  "missing_books",
  "technical_problems",
  "found_another",
  "taking_a_break",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  too_expensive: tk("It costs too much"),
  not_enough_time: tk("I don't have time to read or listen"),
  missing_books: tk("I can't find the books I want"),
  technical_problems: tk("Something isn't working"),
  found_another: tk("I'm using another service"),
  taking_a_break: tk("I'm taking a break"),
  other: tk("Something else"),
};

/** What a member can do instead of cancelling. */
export const SAVE_OFFERS = ["pause", "downgrade", "credit", "upload", "help"] as const;
export type SaveOffer = (typeof SAVE_OFFERS)[number];

export const CANCEL_COMMENT_MAX = 500;

export interface OfferContext {
  planId: PlanId;
  interval: BillingInterval;
  /** The once-per-account month's credit is still on offer (a paying member who hasn't had it). */
  creditAvailable: boolean;
}

/**
 * The one offer that fits the reason, or null. Pausing is for monthly billing only (a year is
 * already paid for); a smaller plan only when there is one; the credit at most once per account.
 */
export function saveOfferFor(reason: CancelReason | null, ctx: OfferContext): SaveOffer | null {
  const credit = ctx.creditAvailable ? "credit" : null;
  switch (reason) {
    case "too_expensive":
      return ctx.planId !== "basic" ? "downgrade" : credit;
    case "not_enough_time":
    case "taking_a_break":
      return ctx.interval === "month" ? "pause" : credit;
    case "missing_books":
      return "upload";
    case "technical_problems":
      return "help";
    case "found_another":
    case "other":
      return credit;
    default:
      return null;
  }
}

/** The plan one step down, for "It costs too much"; null on Basic. */
export function planBelow(planId: PlanId): PlanId | null {
  return planId === "premium" ? "standard" : planId === "standard" ? "basic" : null;
}

/** Why an answer can't be sent, or null. A reason is optional; a comment needs one. */
export function cancelAnswerError(reason: CancelReason | null, comment: string): string | null {
  if (comment.length > CANCEL_COMMENT_MAX) return tk("Keep it to {max} characters.");
  if (comment.trim() && !reason) return tk("Choose a reason to send a note with it.");
  return null;
}
