// POST /functions/v1/referral-retry — billing staff and admins, from the staff dashboard.
// Requires a signed-in account (JWT, and the two-step code when it's on) with the billing or admin role.
//
//   { action: "retry", referralId: uuid }  →  { owed: number, held: boolean, reason: string | null }
//   { action: "dismiss", eventId: "evt_…" } →  { dismissed: boolean }
//
// Retry now: clears the referral's sides held for review (marked retry_requested, so they stay on the
// dashboard until settled) and makes what it still needs at Stripe at once, through the same code as
// stripe-webhook (Stripe's own resend keeps the event id, which is already handled, so it can't).
// Dismiss: a set-aside referral event the team has dealt with leaves the list.

import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { preflight } from "../_shared/cors.ts";
import { onlyKeys, parseUuid } from "../_shared/validate.ts";
import { type Deps as WebhookDeps, retryReferral, SetAside, type SettleDeps } from "../stripe-webhook/handler.ts";

const METHODS = "POST";
const EVENT_ID = /^evt_[A-Za-z0-9]+$/;

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string }>;
  /** Whether the account has the billing or admin role. */
  isBilling: (userId: string) => Promise<boolean>;
  /** referral_retry_start(): clears held sides; the friend's id, or null when there's no such referral. */
  start: (referralId: string) => Promise<string | null>;
  settle: SettleDeps & Pick<WebhookDeps, "referralOwed">;
  dismiss: (eventId: string) => Promise<boolean>;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;
  try {
    requireMethod(req, ["POST"]);
    const user = await deps.requireUser(req);
    if (!(await deps.isBilling(user.id))) throw new HttpError("staff_only", "Only billing staff can retry referral credits.");
    const body = await readJsonBody(req);
    if (body.action === "dismiss") {
      onlyKeys(body, ["action", "eventId"]);
      if (typeof body.eventId !== "string" || !EVENT_ID.test(body.eventId)) throw new HttpError("bad_request", "That isn't a Stripe event id.");
      return json(req, METHODS, { dismissed: await deps.dismiss(body.eventId) });
    }
    if (body.action !== "retry") throw new HttpError("bad_request", "Say retry or dismiss.");
    onlyKeys(body, ["action", "referralId"]);
    const referralId = parseUuid(body.referralId, "referralId");
    if (!(await deps.start(referralId))) throw new HttpError("not_found", "There's no such referral.");
    try {
      return json(req, METHODS, await retryReferral(deps.settle, referralId));
    } catch (err) {
      console.error(`referral-retry: ${referralId} failed`, err);
      if (err instanceof SetAside) throw new HttpError("upstream_error", `Still refused: ${err.message}`);
      throw new HttpError("upstream_error", "Stripe or the database didn't answer. Nothing was made twice; try again in a few minutes.");
    }
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
