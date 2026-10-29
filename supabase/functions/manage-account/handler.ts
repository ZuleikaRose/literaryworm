// POST /functions/v1/manage-account — membership changes and deleting the account.
// Requires a signed-in account (JWT). Subscriptions are never written from the
// browser, and deleting needs the account password again.
//
// An admin's membership is complimentary (never billed), so it can't be paused, resumed,
// cancelled or restarted; deleting the account still works.
//
//   { action: "pause" }                      stop reading and billing until resumed
//   { action: "resume" }
//   { action: "cancel" }                     ends on the next billing date; no more charges
//   { action: "restart" }                    undo a cancel before it takes effect
//   { action: "billing_day", billingDay }    move the billing day (1-28): the days until the new
//                                            date are free, so nothing is charged twice or lost
//   { action: "payment_method" }             returns { url }: Stripe's page to add or change the card
//   { action: "delete", password, confirm: true }
//                                            cancels the plan, then deletes the user (and,
//                                            by cascade, everything the account owns)
//
// A membership billed through Stripe (stripe_subscription_id) is changed in Stripe first, then
// here; the stripe-webhook function keeps the two in step afterwards. Nothing is refunded.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { nextBillingDay } from "../_shared/stripe.ts";
import { onlyKeys, parseInt, parseText } from "../_shared/validate.ts";

const METHODS = "POST";

export interface Subscription {
  plan_id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  /** Null only for a complimentary membership, which is never billed. */
  billing_day: number | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  /** An admin's membership: set by the database from the admin role, never billed. */
  complimentary: boolean;
  /** Set once the member pays through Stripe Checkout. */
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

export type SubscriptionPatch = Partial<Pick<Subscription, "status" | "cancel_at_period_end" | "current_period_end" | "billing_day">>;

/** Changes to the member's Stripe subscription. */
export interface Billing {
  pause: (subscriptionId: string) => Promise<void>;
  resume: (subscriptionId: string) => Promise<void>;
  setCancelAtPeriodEnd: (subscriptionId: string, cancel: boolean) => Promise<void>;
  cancelNow: (subscriptionId: string) => Promise<void>;
  /** Moves the renewal to `until` (unix seconds), with no charge for the days before it. */
  moveRenewal: (subscriptionId: string, until: number) => Promise<void>;
  paymentMethodUrl: (customerId: string, returnUrl: string) => Promise<string>;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  confirmPassword: (email: string, password: string) => Promise<void>;
  rateLimit: (userId: string) => Promise<void>;
  getSubscription: (userId: string) => Promise<Subscription | null>;
  updateSubscription: (userId: string, patch: SubscriptionPatch) => Promise<Subscription>;
  deleteUser: (userId: string) => Promise<void>;
  billing: Billing;
  /** The site to send the member back to: the request's origin when it's allowed. */
  siteOrigin: (req: Request) => string;
  now?: () => Date;
}

/** What the member sees of their membership: Stripe's ids stay on the server. */
export function view({ stripe_subscription_id, stripe_customer_id: _customer, ...rest }: Subscription) {
  return { ...rest, stripe_linked: stripe_subscription_id !== null };
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

/** A paid membership, for pausing, resuming, cancelling and restarting: an admin's has nothing to change. */
async function requirePaidSubscription(deps: Deps, userId: string): Promise<Subscription & { billing_day: number }> {
  const sub = await requireSubscription(deps, userId);
  if (sub.complimentary || sub.billing_day === null) {
    throw new HttpError("bad_request", "Admin memberships are complimentary and never charged, so there's nothing to pause or cancel.");
  }
  return sub as Subscription & { billing_day: number };
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
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "paused") return json(req, METHODS, view(sub));
        if (sub.status !== "active") throw new HttpError("bad_request", "Only an active membership can be paused.");
        if (sub.cancel_at_period_end) {
          throw new HttpError("bad_request", "This membership is set to end. Restart it before pausing.");
        }
        if (sub.stripe_subscription_id) await deps.billing.pause(sub.stripe_subscription_id);
        return json(req, METHODS, view(await deps.updateSubscription(user.id, { status: "paused" })));
      }
      case "resume": {
        onlyKeys(body, ["action"]);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "active") return json(req, METHODS, view(sub));
        if (sub.status !== "paused") throw new HttpError("bad_request", "Only a paused membership can be resumed.");
        if (sub.stripe_subscription_id) await deps.billing.resume(sub.stripe_subscription_id);
        return json(req, METHODS, view(await deps.updateSubscription(user.id, { status: "active" })));
      }
      case "cancel": {
        onlyKeys(body, ["action"]);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "cancelled") return json(req, METHODS, view(sub));
        // Nothing more is charged; reading continues until the date already paid for.
        if (sub.stripe_subscription_id) await deps.billing.setCancelAtPeriodEnd(sub.stripe_subscription_id, true);
        const ends = sub.stripe_subscription_id && sub.current_period_end
          ? sub.current_period_end
          : nextBillingDate(sub.billing_day, now).toISOString();
        return json(
          req,
          METHODS,
          await deps.updateSubscription(user.id, { status: "active", cancel_at_period_end: true, current_period_end: ends }),
        );
      }
      case "restart": {
        onlyKeys(body, ["action"]);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "cancelled") {
          throw new HttpError("bad_request", "This membership has ended. Choose a plan to start again.");
        }
        if (sub.stripe_subscription_id) {
          await deps.billing.setCancelAtPeriodEnd(sub.stripe_subscription_id, false);
          return json(req, METHODS, view(await deps.updateSubscription(user.id, { cancel_at_period_end: false })));
        }
        return json(req, METHODS, view(await deps.updateSubscription(user.id, { cancel_at_period_end: false, current_period_end: null })));
      }
      case "billing_day": {
        onlyKeys(body, ["action", "billingDay"]);
        const day = parseInt(body.billingDay, "billingDay", 1, 28);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.billing_day === day) throw new HttpError("bad_request", "That's already your billing day.");
        if (sub.status !== "active" || sub.cancel_at_period_end) {
          throw new HttpError("bad_request", "Only an active membership that isn't ending can change its billing day.");
        }
        if (sub.stripe_subscription_id) {
          // The new day's first date on or after the end of the period already paid for: the days
          // in between are free, so the member never pays twice or loses paid days.
          const paidUntil = sub.current_period_end ? new Date(sub.current_period_end) : now;
          const firstDay = new Date(Date.UTC(paidUntil.getUTCFullYear(), paidUntil.getUTCMonth(), day));
          const until = firstDay >= paidUntil ? firstDay : nextBillingDay(day, paidUntil);
          await deps.billing.moveRenewal(sub.stripe_subscription_id, Math.floor(until.getTime() / 1000));
        }
        return json(req, METHODS, view(await deps.updateSubscription(user.id, { billing_day: day })));
      }
      case "payment_method": {
        onlyKeys(body, ["action"]);
        const sub = await requirePaidSubscription(deps, user.id);
        if (!sub.stripe_customer_id) {
          throw new HttpError("bad_request", "Choose your plan to add a payment method.");
        }
        const url = await deps.billing.paymentMethodUrl(sub.stripe_customer_id, `${deps.siteOrigin(req)}/account#plan`);
        return json(req, METHODS, { url });
      }
      case "delete": {
        onlyKeys(body, ["action", "password", "confirm"]);
        if (body.confirm !== true) throw new HttpError("bad_request", "Confirm that you want to delete the account.");
        const password = parseText(body.password, "password", 1, 128);
        if (!user.email) throw new HttpError("forbidden", "This account has no email address.");
        await deps.confirmPassword(user.email, password);
        // Cancel first, so a failure part-way through never leaves a plan that keeps charging.
        const sub = await deps.getSubscription(user.id);
        if (sub && !sub.complimentary && sub.status !== "cancelled") {
          if (sub.stripe_subscription_id) await deps.billing.cancelNow(sub.stripe_subscription_id);
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
