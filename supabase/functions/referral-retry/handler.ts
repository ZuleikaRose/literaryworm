// POST /functions/v1/referral-retry — billing staff and admins, from the staff dashboard.
// Requires a signed-in account (JWT, and the two-step code when it's on) with the billing or admin role.
//
//   { action: "retry", referralId: uuid } → { decided: false }
//                                         | { decided: true, owed: number, held: boolean, reason: string | null }
//   { action: "replay", eventId: "evt_…" } → { done: boolean, reason: string | null }
//   { action: "dismiss", eventId: "evt_…" } → { dismissed: boolean }
//
// retry: clears the referral's held sides (retry requested, so they stay listed until settled) and makes
// what it still owes at once, with stripe-webhook's own code. An undecided referral has nothing to make:
// its set-aside event is replayed instead.
// replay: runs stripe-webhook's handler again on the event it kept when it set it aside (only the
// duplicate check is skipped; Stripe's own resend keeps the event id, which is already handled). The
// event is resolved when nothing is set aside again.
// dismiss: refused while the event's referral still owes anything or has a take-back or give-back waiting.

import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { preflight } from "../_shared/cors.ts";
import { onlyKeys, parseUuid } from "../_shared/validate.ts";
import type { Stripe } from "../_shared/stripe.ts";
import { type Deps as WebhookDeps, replayEvent, retryReferral, SetAside } from "../stripe-webhook/handler.ts";

const METHODS = "POST";
const EVENT_ID = /^evt_[A-Za-z0-9]+$/;
const STILL_OWED = "referral_still_owed";

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string }>;
  /** Whether the account has the billing or admin role. */
  isBilling: (userId: string) => Promise<boolean>;
  /** referral_retry_start(): clears held sides; null when there's no such referral. */
  start: (referralId: string) => Promise<{ referredId: string; decided: boolean } | null>;
  /** The event stripe-webhook kept when it set it aside (null if none was kept). */
  storedEvent: (eventId: string) => Promise<Stripe.Event | null>;
  /** record_referral_event_replay(). */
  recordReplay: (eventId: string, ok: boolean, reason: string | null) => Promise<void>;
  /** dismiss_referral_event(); throws an error whose message has referral_still_owed when it refuses. */
  dismiss: (eventId: string) => Promise<boolean>;
  webhook: () => WebhookDeps;
}

function eventId(raw: unknown): string {
  if (typeof raw !== "string" || !EVENT_ID.test(raw)) throw new HttpError("bad_request", "That isn't a Stripe event id.");
  return raw;
}

const temporary = (err: unknown) => {
  if (err instanceof SetAside) return new HttpError("upstream_error", `Still refused: ${err.message}`);
  return new HttpError("upstream_error", "Stripe or the database didn't answer. Nothing was made twice; try again in a few minutes.");
};

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
      const id = eventId(body.eventId);
      try {
        return json(req, METHODS, { dismissed: await deps.dismiss(id) });
      } catch (err) {
        if ((err as Error)?.message?.includes(STILL_OWED)) {
          throw new HttpError("still_owed", "Something is still owed for this referral: use Retry now, or Write off a held side.");
        }
        throw err;
      }
    }

    if (body.action === "replay") {
      onlyKeys(body, ["action", "eventId"]);
      const id = eventId(body.eventId);
      const event = await deps.storedEvent(id);
      if (!event) throw new HttpError("not_found", "This event wasn't kept, so it can't be replayed. Use Retry now on its referral.");
      let result;
      try {
        result = await replayEvent(deps.webhook(), event);
      } catch (err) {
        console.error(`referral-retry: replaying ${id} failed`, err);
        throw temporary(err);
      }
      await deps.recordReplay(id, !result.review, result.note?.reason ?? null);
      return json(req, METHODS, { done: !result.review, reason: result.note?.reason ?? null });
    }

    if (body.action !== "retry") throw new HttpError("bad_request", "Say retry, replay or dismiss.");
    onlyKeys(body, ["action", "referralId"]);
    const referralId = parseUuid(body.referralId, "referralId");
    const started = await deps.start(referralId);
    if (!started) throw new HttpError("not_found", "There's no such referral.");
    if (!started.decided) return json(req, METHODS, { decided: false });
    try {
      return json(req, METHODS, { decided: true, ...(await retryReferral(deps.webhook(), referralId)) });
    } catch (err) {
      console.error(`referral-retry: ${referralId} failed`, err);
      throw temporary(err);
    }
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
