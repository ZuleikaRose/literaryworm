// POST /functions/v1/checkout — start a membership, change plan, or buy a gift.
// Requires a signed-in account (JWT). Subscriptions are never written from the browser.
//
//   { planId: "basic" | "standard" | "premium", interval?: "month" | "year", billingDay: 1-28,
//     renewalTermsAccepted: true, setup?: true }
//
// interval is "month" unless given. Yearly costs ten times the monthly price and starts the day it's
// bought (billingDay isn't needed); it renews on that date each year.
//   { gift: true, planId, months: 1 | 3 | 6 | 12 }
//
// A gift is a one-off payment on Stripe Checkout (months × the plan's monthly price, or the
// yearly price for 12 months, nothing recurring): this returns { url }, and once Stripe confirms payment the stripe-webhook function
// makes the gift code, which the buyer sees in /gifts. Stripe sends them back to /gifts?checkout=success.
//
// Stripe sends the member back to /plans?checkout=success (with &setup=1 during sign-up), where
// the page waits for the webhook to write the membership.
//
// A new membership goes through Stripe Checkout (Stripe-hosted): this returns { url } to send the
// member to, and the stripe-webhook function writes the membership once Stripe confirms payment.
// The first charge covers the days until the billing day; then the full price on that day each month.
// A member already billed through Stripe changes plan in place ({ planId, interval }):
//   - monthly to monthly: the new price applies from the next renewal, with no partial charges or
//     credits (all sales are final);
//   - monthly to yearly: the year starts today, and the unused part of the month comes off its price;
//   - yearly to a dearer yearly plan: the difference for the rest of the year is charged today;
//     to a cheaper one, the lower price applies from the next renewal, with no credit;
//   - yearly to monthly happens at renewal: a Stripe subscription schedule keeps the year as it is and
//     bills the monthly price from the day it would have renewed (nothing charged or credited now).
//     Choosing yearly again before then keeps the yearly membership (the schedule is released);
//     choosing another yearly plan drops the switch first. An ending membership can't switch.
//   Response: { planId, interval, switchesAt? } (switchesAt: when monthly billing starts).
//
// Staff are never billed: everyone with a staff role (Admin, Editor, Developer, Billing, Customer
// service, Blog, Sales) has a complimentary membership while they hold it (the database makes it so
// from staff_roles), so this refuses them before anything else and never creates a Checkout for them.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { type BillingInterval, GIFT_MONTHS, type GiftMonths, INTERVALS, nextBillingDay, PLANS, type PlanId } from "../_shared/stripe.ts";
import { onlyKeys, parseInt } from "../_shared/validate.ts";

export const METHODS = "POST";

export interface Membership {
  plan_id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  billing_interval: BillingInterval;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  /** The plan a yearly membership moves to, monthly, at renewal (from Stripe, by the webhook). */
  switch_to_monthly: string | null;
}

export interface CheckoutInput {
  customerId: string;
  userId: string;
  planId: PlanId;
  interval: BillingInterval;
  /** Unix seconds of the first full charge; null to bill from today. */
  billingCycleAnchor: number | null;
  billingDay: number;
  origin: string;
  /** True during sign-up, so the member continues to setting up profiles afterwards. */
  setup: boolean;
}

export interface GiftCheckoutInput {
  customerId: string;
  userId: string;
  planId: PlanId;
  months: GiftMonths;
  origin: string;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  rateLimit: (userId: string) => Promise<void>;
  /** Whether the account holds any staff role. */
  isStaff: (userId: string) => Promise<boolean>;
  getMembership: (userId: string) => Promise<Membership | null>;
  /** The account's Stripe Customer, created (and remembered) the first time. */
  customerFor: (userId: string, email: string | undefined) => Promise<string>;
  createCheckout: (input: CheckoutInput) => Promise<string>;
  createGiftCheckout: (input: GiftCheckoutInput) => Promise<string>;
  /** Moves a Stripe subscription to the plan's price for `interval`, from `from` (its interval now). */
  changePlan: (subscriptionId: string, planId: PlanId, interval: BillingInterval, from: BillingInterval) => Promise<void>;
  /** Schedules a yearly subscription to move to the plan's monthly price when the year ends. */
  scheduleMonthly: (subscriptionId: string, planId: PlanId) => Promise<void>;
  /** Drops a scheduled move to monthly, keeping the yearly membership as it is. */
  keepYearly: (subscriptionId: string) => Promise<void>;
  /** The site to send the member back to: the request's origin when it's allowed. */
  siteOrigin: (req: Request) => string;
  now?: () => Date;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const user = await deps.requireUser(req);
    await deps.rateLimit(user.id);
    if (await deps.isStaff(user.id)) {
      throw new HttpError("bad_request", "Staff accounts have a complimentary membership and are never charged.");
    }
    const body = await readJsonBody(req);
    if (body.gift !== undefined) {
      onlyKeys(body, ["gift", "planId", "months"]);
      if (body.gift !== true) throw new HttpError("bad_request", "gift is true when buying a gift.");
      if (typeof body.planId !== "string" || !PLANS.includes(body.planId as PlanId)) {
        throw new HttpError("bad_request", "Pick Basic, Standard or Premium.");
      }
      const months = body.months;
      if (typeof months !== "number" || !GIFT_MONTHS.includes(months as GiftMonths)) {
        throw new HttpError("bad_request", "Pick 1, 3, 6 or 12 months.");
      }
      const customerId = await deps.customerFor(user.id, user.email);
      const url = await deps.createGiftCheckout({
        customerId,
        userId: user.id,
        planId: body.planId as PlanId,
        months: months as GiftMonths,
        origin: deps.siteOrigin(req),
      });
      return json(req, METHODS, { url });
    }
    onlyKeys(body, ["planId", "interval", "billingDay", "renewalTermsAccepted", "setup"]);
    if (body.setup !== undefined && typeof body.setup !== "boolean") throw new HttpError("bad_request", "setup is true or false.");
    if (typeof body.planId !== "string" || !PLANS.includes(body.planId as PlanId)) {
      throw new HttpError("bad_request", "Pick Basic, Standard or Premium.");
    }
    const planId = body.planId as PlanId;
    if (body.interval !== undefined && !INTERVALS.includes(body.interval as BillingInterval)) {
      throw new HttpError("bad_request", "Pick monthly or yearly billing.");
    }
    const interval = (body.interval ?? "month") as BillingInterval;
    const now = deps.now?.() ?? new Date();
    // A year starts the day it's bought; its day of the month is kept only as a label (1–28).
    const billingDay = interval === "year" && body.billingDay === undefined
      ? Math.min(now.getUTCDate(), 28)
      : parseInt(body.billingDay, "billingDay", 1, 28);
    if (body.renewalTermsAccepted !== true) {
      throw new HttpError("bad_request", "Agree to the renewal terms to continue.");
    }

    const membership = await deps.getMembership(user.id);
    if (membership?.stripe_subscription_id && membership.status !== "cancelled") {
      const subId = membership.stripe_subscription_id;
      const current = membership.billing_interval ?? "month";
      const switching = current === "year" && membership.switch_to_monthly !== null;
      if (current === "year" && interval === "month") {
        if (membership.cancel_at_period_end) {
          throw new HttpError("bad_request", "This membership is set to end. Restart it in Account first, or choose monthly once it ends.");
        }
        if (membership.status !== "active") throw new HttpError("bad_request", "Only an active membership can change how it's billed.");
        if (membership.switch_to_monthly === planId) throw new HttpError("bad_request", "That's already what happens at renewal.");
        // Nothing changes until the year is up; then the monthly price, on that day each month.
        await deps.scheduleMonthly(subId, planId);
        return json(req, METHODS, { planId, interval, switchesAt: membership.current_period_end });
      }
      if (membership.plan_id === planId && current === interval) {
        if (!switching) throw new HttpError("bad_request", "That's already your plan.");
        await deps.keepYearly(subId);
        return json(req, METHODS, { planId, interval });
      }
      // Another yearly plan replaces a scheduled move to monthly.
      if (switching) await deps.keepYearly(subId);
      await deps.changePlan(subId, planId, interval, current);
      return json(req, METHODS, { planId, interval });
    }

    const anchor = interval === "year" || now.getUTCDate() === billingDay
      ? null
      : Math.floor(nextBillingDay(billingDay, now).getTime() / 1000);
    const customerId = await deps.customerFor(user.id, user.email);
    const url = await deps.createCheckout({
      customerId,
      userId: user.id,
      planId,
      interval,
      billingCycleAnchor: anchor,
      billingDay,
      origin: deps.siteOrigin(req),
      setup: body.setup === true,
    });
    return json(req, METHODS, { url });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
