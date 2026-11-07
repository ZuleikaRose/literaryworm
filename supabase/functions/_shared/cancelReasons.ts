// Why a member cancels, and what they were offered instead: the same lists as the app's
// src/lib/cancelSurvey.ts and the checks on public.cancellation_feedback (cancelSurvey.test.ts checks).

import { HttpError } from "./http.ts";

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

export const SAVE_OFFERS = ["pause", "downgrade", "credit", "upload", "help"] as const;
export type SaveOffer = (typeof SAVE_OFFERS)[number];

export const CANCEL_COMMENT_MAX = 500;

export interface CancelAnswer {
  reason: CancelReason;
  comment: string | null;
  offer: SaveOffer | null;
}

/** The member's optional answer: null when they gave no reason. Refuses anything else. */
export function parseCancelAnswer(body: Record<string, unknown>): CancelAnswer | null {
  const { reason, comment, offer } = body;
  if (reason === undefined || reason === null) {
    if ((typeof comment === "string" && comment.trim()) || (offer !== undefined && offer !== null)) {
      throw new HttpError("bad_request", "Choose a reason to send a note with it.");
    }
    return null;
  }
  if (typeof reason !== "string" || !(CANCEL_REASONS as readonly string[]).includes(reason)) {
    throw new HttpError("bad_request", "That isn't one of the reasons.");
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") throw new HttpError("bad_request", "The note must be text.");
  const text = typeof comment === "string" ? comment.trim() : "";
  if (text.length > CANCEL_COMMENT_MAX) throw new HttpError("bad_request", `Keep the note to ${CANCEL_COMMENT_MAX} characters.`);
  if (offer !== undefined && offer !== null && (typeof offer !== "string" || !(SAVE_OFFERS as readonly string[]).includes(offer))) {
    throw new HttpError("bad_request", "That isn't one of the offers.");
  }
  return { reason: reason as CancelReason, comment: text || null, offer: (offer as SaveOffer | null | undefined) ?? null };
}
