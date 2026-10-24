// POST /functions/v1/manage-account — membership changes and deleting the account.
// Requires a signed-in account (JWT). Subscriptions are never written from the
// browser, and deleting needs the account password again.
//
//   { action: "pause" }                      stop reading and billing until resumed
//   { action: "resume" }
//   { action: "cancel" }                     ends on the next billing date; no more charges
//   { action: "restart" }                    undo a cancel before it takes effect
//   { action: "delete", password, confirm: true }
//                                            cancels the plan, then deletes the user (and,
//                                            by cascade, everything the account owns)

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseText } from "../_shared/validate.ts";

const METHODS = "POST";

export interface Subscription {
  plan_id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  billing_day: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

export type SubscriptionPatch = Partial<Pick<Subscription, "status" | "cancel_at_period_end" | "current_period_end">>;

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  confirmPassword: (email: string, password: string) => Promise<void>;
  rateLimit: (userId: string) => Promise<void>;
  getSubscription: (userId: string) => Promise<Subscription | null>;
  updateSubscription: (userId: string, patch: SubscriptionPatch) => Promise<Subscription>;
  deleteUser: (userId: string) => Promise<void>;
  now?: () => Date;
}

/** The next date the plan would renew: the billing day this month if it's still ahead, else next month. */
export function nextBillingDate(billingDay: number, now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const thisMonth = new Date(Date.UTC(year, month, billingDay));
  return now.getUTCDate() < billingDay ? thisMonth : new Date(Date.UTC(year, month + 1, billingDay));
}

async function requireSubscription(deps: Deps, userId: string): Promise<Subscription> {
  const sub = await deps.getSubscription(userId);
  if (!sub) throw new HttpError("not_found", "This account has no plan yet. Choose one first.");
  return sub;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const user = await deps.requireUser(req);
    await deps.rateLimit(user.id);
    const body = await readJsonBody(req);
    const now = deps.now?.() ?? new Date();

    switch (body.action) {
      case "pause": {
        onlyKeys(body, ["action"]);
        const sub = await requireSubscription(deps, user.id);
        if (sub.status === "paused") return json(req, METHODS, sub);
        if (sub.status !== "active") throw new HttpError("bad_request", "Only an active membership can be paused.");
        if (sub.cancel_at_period_end) {
          throw new HttpError("bad_request", "This membership is set to end. Restart it before pausing.");
        }
        return json(req, METHODS, await deps.updateSubscription(user.id, { status: "paused" }));
      }
      case "resume": {
        onlyKeys(body, ["action"]);
        const sub = await requireSubscription(deps, user.id);
        if (sub.status === "active") return json(req, METHODS, sub);
        if (sub.status !== "paused") throw new HttpError("bad_request", "Only a paused membership can be resumed.");
        return json(req, METHODS, await deps.updateSubscription(user.id, { status: "active" }));
      }
      case "cancel": {
        onlyKeys(body, ["action"]);
        const sub = await requireSubscription(deps, user.id);
        if (sub.status === "cancelled") return json(req, METHODS, sub);
        // Nothing more is charged; reading continues until the date already paid for.
        const ends = nextBillingDate(sub.billing_day, now).toISOString();
        return json(
          req,
          METHODS,
          await deps.updateSubscription(user.id, { status: "active", cancel_at_period_end: true, current_period_end: ends }),
        );
      }
      case "restart": {
        onlyKeys(body, ["action"]);
        const sub = await requireSubscription(deps, user.id);
        if (sub.status === "cancelled") {
          throw new HttpError("bad_request", "This membership has ended. Choose a plan to start again.");
        }
        return json(req, METHODS, await deps.updateSubscription(user.id, { cancel_at_period_end: false, current_period_end: null }));
      }
      case "delete": {
        onlyKeys(body, ["action", "password", "confirm"]);
        if (body.confirm !== true) throw new HttpError("bad_request", "Confirm that you want to delete the account.");
        const password = parseText(body.password, "password", 1, 128);
        if (!user.email) throw new HttpError("forbidden", "This account has no email address.");
        await deps.confirmPassword(user.email, password);
        // Cancel first, so a failure part-way through never leaves a plan that keeps charging.
        const sub = await deps.getSubscription(user.id);
        if (sub && sub.status !== "cancelled") {
          await deps.updateSubscription(user.id, { status: "cancelled", cancel_at_period_end: false, current_period_end: now.toISOString() });
        }
        await deps.deleteUser(user.id);
        return json(req, METHODS, { deleted: true });
      }
      default:
        throw new HttpError("bad_request", "Unknown action.");
    }
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
