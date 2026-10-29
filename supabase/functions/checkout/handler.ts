// POST /functions/v1/checkout — start a membership or change plan.
// Requires a signed-in account (JWT). Subscriptions are never written from the browser.
//
//   { planId: "basic" | "standard" | "premium", billingDay: 1-28, renewalTermsAccepted: true, setup?: true }
//
// Stripe sends the member back to /plans?checkout=success (with &setup=1 during sign-up), where
// the page waits for the webhook to write the membership.
//
// A new membership goes through Stripe Checkout (Stripe-hosted): this returns { url } to send the
// member to, and the stripe-webhook function writes the membership once Stripe confirms payment.
// The first charge covers the days until the billing day; then the full price on that day each month.
// A member already billed through Stripe changes plan in place ({ planId }): the new price applies
// from the next renewal, with no partial charges or credits (all sales are final).
//
// Admins are never billed: their membership is complimentary (the database makes it so from the
// admin role), so this refuses them before anything else and never creates a Checkout for them.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { nextBillingDay, PLANS, type PlanId } from "../_shared/stripe.ts";
import { onlyKeys, parseInt } from "../_shared/validate.ts";

export const METHODS = "POST";

export interface Membership {
  plan_id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  stripe_subscription_id: string | null;
}

export interface CheckoutInput {
  customerId: string;
  userId: string;
  planId: PlanId;
  /** Unix seconds of the first full charge; null to bill from today. */
  billingCycleAnchor: number | null;
  billingDay: number;
  origin: string;
  /** True during sign-up, so the member continues to setting up profiles afterwards. */
  setup: boolean;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  rateLimit: (userId: string) => Promise<void>;
  isAdmin: (userId: string) => Promise<boolean>;
  getMembership: (userId: string) => Promise<Membership | null>;
  /** The account's Stripe Customer, created (and remembered) the first time. */
  customerFor: (userId: string, email: string | undefined) => Promise<string>;
  createCheckout: (input: CheckoutInput) => Promise<string>;
  changePlan: (subscriptionId: string, planId: PlanId) => Promise<void>;
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
    if (await deps.isAdmin(user.id)) {
      throw new HttpError("bad_request", "Admin accounts have a complimentary membership and are never charged.");
    }
    const body = await readJsonBody(req);
    onlyKeys(body, ["planId", "billingDay", "renewalTermsAccepted", "setup"]);
    if (body.setup !== undefined && typeof body.setup !== "boolean") throw new HttpError("bad_request", "setup is true or false.");
    if (typeof body.planId !== "string" || !PLANS.includes(body.planId as PlanId)) {
      throw new HttpError("bad_request", "Pick Basic, Standard or Premium.");
    }
    const planId = body.planId as PlanId;
    const billingDay = parseInt(body.billingDay, "billingDay", 1, 28);
    if (body.renewalTermsAccepted !== true) {
      throw new HttpError("bad_request", "Agree to the renewal terms to continue.");
    }

    const membership = await deps.getMembership(user.id);
    if (membership?.stripe_subscription_id && membership.status !== "cancelled") {
      if (membership.plan_id === planId) throw new HttpError("bad_request", "That's already your plan.");
      await deps.changePlan(membership.stripe_subscription_id, planId);
      return json(req, METHODS, { planId });
    }

    const now = deps.now?.() ?? new Date();
    const anchor = now.getUTCDate() === billingDay ? null : Math.floor(nextBillingDay(billingDay, now).getTime() / 1000);
    const customerId = await deps.customerFor(user.id, user.email);
    const url = await deps.createCheckout({
      customerId,
      userId: user.id,
      planId,
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
