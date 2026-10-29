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
//   { action: "billing_history" }            returns { invoices, discount }: the last 24 charges
//                                            (newest first) and the promo code on the membership
//   { action: "promo_code", code }           applies a Stripe promotion code to the membership
//                                            (replacing any it has); returns { discount }
//   { action: "gift", code, renewalTermsAccepted? }
//                                            redeems a gift code (once). A membership on the
//                                            gift's plan gets the months free (its next charge
//                                            moves back); without a membership, Stripe starts one
//                                            free for the months, which ends then unless a card
//                                            is added (the member agrees to that: renewalTermsAccepted),
//                                            and the webhook writes it. Returns { gift, subscription? }
//   { action: "delete", password, confirm: true }
//                                            cancels the plan, then deletes the user (and,
//                                            by cascade, everything the account owns)
//
// A membership billed through Stripe (stripe_subscription_id) is changed in Stripe first, then
// here; the stripe-webhook function keeps the two in step afterwards. Nothing is refunded.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { addGiftMonths, type DiscountView, type InvoiceView, nextBillingDay, PLAN_NAMES, type PlanId } from "../_shared/stripe.ts";
import { onlyKeys, parseGiftCode, parseInt, parsePromoCode, parseText } from "../_shared/validate.ts";

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
  /** The end of a gift's free months, while they last. */
  gift_until: string | null;
  /** Set once the member pays through Stripe Checkout. */
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

export type SubscriptionPatch = Partial<
  Pick<Subscription, "status" | "cancel_at_period_end" | "current_period_end" | "billing_day" | "gift_until">
>;

export interface Gift {
  id: string;
  plan_id: PlanId;
  months: number;
  redeemed_at: string | null;
}

/** Gift codes (gift_codes): found by code, and claimed by one account at a time. */
export interface Gifts {
  find: (code: string) => Promise<Gift | null>;
  /** Marks the gift redeemed by the account; false when someone else got there first. */
  claim: (giftId: string, userId: string) => Promise<boolean>;
  /** Undoes a claim when Stripe couldn't apply the gift, so the code still works. */
  release: (giftId: string) => Promise<void>;
}

/** Changes to the member's Stripe subscription. */
export interface Billing {
  pause: (subscriptionId: string) => Promise<void>;
  resume: (subscriptionId: string) => Promise<void>;
  setCancelAtPeriodEnd: (subscriptionId: string, cancel: boolean) => Promise<void>;
  cancelNow: (subscriptionId: string) => Promise<void>;
  /** Moves the renewal to `until` (unix seconds), with no charge for the days before it. */
  moveRenewal: (subscriptionId: string, until: number) => Promise<void>;
  paymentMethodUrl: (customerId: string, returnUrl: string) => Promise<string>;
  /** The customer's latest invoices, newest first. */
  invoices: (customerId: string) => Promise<InvoiceView[]>;
  discount: (subscriptionId: string) => Promise<DiscountView | null>;
  /** Applies an active promotion code; null when there's no such code or Stripe won't apply it. */
  redeem: (subscriptionId: string, code: string) => Promise<DiscountView | null>;
  /** Moves the next charge to `until` (unix seconds) and records it as a gift's free months. */
  extendForGift: (subscriptionId: string, until: number) => Promise<void>;
  /** A new subscription on the plan, free until `until`, ending then unless a card is added. */
  startGift: (input: { giftId: string; customerId: string; planId: PlanId; until: number; consentAt: string }) => Promise<void>;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  confirmPassword: (email: string, password: string) => Promise<void>;
  rateLimit: (userId: string) => Promise<void>;
  getSubscription: (userId: string) => Promise<Subscription | null>;
  updateSubscription: (userId: string, patch: SubscriptionPatch) => Promise<Subscription>;
  deleteUser: (userId: string) => Promise<void>;
  billing: Billing;
  gifts: Gifts;
  /** The account's Stripe Customer, created the first time. */
  customerFor: (userId: string, email: string | undefined) => Promise<string>;
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
          view(await deps.updateSubscription(user.id, { status: "active", cancel_at_period_end: true, current_period_end: ends })),
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
        if (sub.gift_until && new Date(sub.gift_until) > now) {
          throw new HttpError("bad_request", "You can change the billing day once the gift's free months are over.");
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
      case "billing_history": {
        onlyKeys(body, ["action"]);
        const sub = await requireSubscription(deps, user.id);
        if (sub.complimentary || !sub.stripe_customer_id) return json(req, METHODS, { invoices: [], discount: null });
        const live = sub.stripe_subscription_id && sub.status !== "cancelled" ? sub.stripe_subscription_id : null;
        const [invoices, discount] = await Promise.all([
          deps.billing.invoices(sub.stripe_customer_id),
          live ? deps.billing.discount(live) : null,
        ]);
        return json(req, METHODS, { invoices, discount });
      }
      case "promo_code": {
        onlyKeys(body, ["action", "code"]);
        const code = parsePromoCode(body.code);
        const sub = await requirePaidSubscription(deps, user.id);
        if (!sub.stripe_subscription_id || sub.status === "cancelled") {
          throw new HttpError("bad_request", "Add a payment method first. You can also enter a code on Stripe's payment page.");
        }
        const discount = await deps.billing.redeem(sub.stripe_subscription_id, code);
        if (!discount) throw new HttpError("bad_request", "That code isn't valid, has expired or can't be used on this membership.");
        return json(req, METHODS, { discount });
      }
      case "gift": {
        onlyKeys(body, ["action", "code", "renewalTermsAccepted"]);
        const code = parseGiftCode(body.code);
        if (body.renewalTermsAccepted !== undefined && typeof body.renewalTermsAccepted !== "boolean") {
          throw new HttpError("bad_request", "renewalTermsAccepted is true or false.");
        }
        const sub = await deps.getSubscription(user.id);
        if (sub?.complimentary) {
          throw new HttpError("bad_request", "Admin memberships are complimentary, so a gift adds nothing. Pass the code on to someone else.");
        }
        const gift = await deps.gifts.find(code);
        if (!gift || gift.redeemed_at) throw new HttpError("bad_request", "That gift code isn't valid or has already been used.");
        const giftPlan = PLAN_NAMES[gift.plan_id];
        // A membership billed through Stripe that hasn't ended gets the months added.
        const live = sub && sub.stripe_subscription_id && sub.status !== "cancelled" ? sub : null;
        if (live) {
          if (live.status === "paused") throw new HttpError("bad_request", "Resume your membership first, then redeem the gift.");
          if (live.status === "past_due") {
            throw new HttpError("bad_request", "Your last payment didn't go through. Update your payment method first, then redeem the gift.");
          }
          if (live.plan_id !== gift.plan_id) {
            const yours = PLAN_NAMES[live.plan_id as PlanId] ?? live.plan_id;
            throw new HttpError("bad_request", `This gift is for ${giftPlan} and your membership is ${yours}. Change to ${giftPlan} in Plans to use it, or pass the code on.`);
          }
        } else if (body.renewalTermsAccepted !== true) {
          throw new HttpError("bad_request", "Agree to what happens when the gift ends to continue.");
        }
        if (!(await deps.gifts.claim(gift.id, user.id))) {
          throw new HttpError("bad_request", "That gift code isn't valid or has already been used.");
        }
        // After everything already paid for (or already free), never before today.
        const paidUntil = live?.current_period_end ? new Date(live.current_period_end) : now;
        const until = addGiftMonths(live && paidUntil > now ? paidUntil : now, gift.months);
        const given = { planId: gift.plan_id, months: gift.months, until: until.toISOString() };
        // Only a failure before Stripe has the months gives the code back; once Stripe has them,
        // the code stays used (the webhook brings the membership into step either way).
        try {
          if (live) {
            await deps.billing.extendForGift(live.stripe_subscription_id!, Math.floor(until.getTime() / 1000));
          } else {
            const customerId = await deps.customerFor(user.id, user.email);
            await deps.billing.startGift({
              giftId: gift.id,
              customerId,
              planId: gift.plan_id,
              until: Math.floor(until.getTime() / 1000),
              consentAt: now.toISOString(),
            });
          }
        } catch (err) {
          await deps.gifts.release(gift.id);
          throw err;
        }
        if (!live) {
          // The webhook writes the membership in a moment; Account waits for it.
          return json(req, METHODS, { gift: given });
        }
        const updated = await deps.updateSubscription(user.id, { current_period_end: given.until, gift_until: given.until });
        return json(req, METHODS, { gift: given, subscription: view(updated) });
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
