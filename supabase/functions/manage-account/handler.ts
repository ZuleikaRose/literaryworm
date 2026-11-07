// POST /functions/v1/manage-account — membership changes and deleting the account.
// Requires a signed-in account (JWT). Subscriptions are never written from the
// browser, and deleting needs the account password again.
//
// Staff memberships are complimentary (never billed), so they can't be paused, resumed,
// cancelled or restarted; deleting the account still works.
//
//   { action: "pause" }                      stop reading and billing until resumed (monthly only)
//   { action: "resume" }
//   { action: "cancel", reason?, comment?, offer? }
//                                            ends on the next billing date with no more charges,
//                                            given at least 48 hours' notice; with less, that charge
//                                            still goes through and it ends a period (a month, or
//                                            a year when billed yearly) later. No refunds
//                                            The optional answer (why, a note, the offer shown) is
//                                            kept in cancellation_feedback; failing to keep it never
//                                            stops the cancellation
//   { action: "save_offer_check" }           returns { creditCents }: the once-per-account month's
//                                            credit on offer instead of cancelling, or null
//   { action: "save_offer", reason, comment? }
//                                            takes that credit (a Stripe customer balance credit of a
//                                            month of the member's plan): claimed first, handed back
//                                            if Stripe fails. Returns { creditCents }
//   { action: "cancel_feedback", reason, comment?, offer }
//                                            the member took another offer (pause, a smaller plan,
//                                            uploads, Help) instead of cancelling: kept as "kept"
//   { action: "restart" }                    undo a cancel before it takes effect
//   { action: "billing_day", billingDay }    move the billing day (1-28): the days until the new
//                                            date are free, so nothing is charged twice or lost.
//                                            Monthly only: a year renews on the date it started
//   { action: "payment_method" }             returns { url }: Stripe's page to add or change the card
//   { action: "billing_history" }            returns { invoices, discount }: the last 24 charges
//                                            (newest first) and the promo code on the membership
//   { action: "promo_code", code }           applies a Stripe promotion code to the membership
//                                            (replacing any it has); returns { discount }
//   { action: "gift", code, renewalTermsAccepted? }
//                                            redeems a gift code (once). A gift card adds its credit
//                                            to the account's Stripe balance (taken off the next
//                                            charges, a membership or not). Otherwise: A membership on the
//                                            gift's plan gets the months free (its next charge
//                                            moves back); without a membership, Stripe starts one
//                                            free for the months, which ends then unless a card
//                                            is added (the member agrees to that: renewalTermsAccepted),
//                                            and the webhook writes it. Books that come with the
//                                            gift go into the library as Want to read. Returns
//                                            { gift: { planId, months, until, books }, subscription? }
//   { action: "delete", password, confirm: true }
//                                            cancels the plan, then deletes the user (and,
//                                            by cascade, everything the account owns), then
//                                            emails the address to confirm it
//
// A membership billed through Stripe (stripe_subscription_id) is changed in Stripe first, then
// here; the stripe-webhook function keeps the two in step afterwards. Nothing is refunded.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { addGiftMonths, type BillingInterval, cancellationEnd, type DiscountView, giftStarted, type InvoiceView, nextBillingDay, PLAN_NAMES, type PlanId } from "../_shared/stripe.ts";
import { type CancelAnswer, parseCancelAnswer } from "../_shared/cancelReasons.ts";
import { onlyKeys, parseGiftCode, parseInt, parsePromoCode, parseText } from "../_shared/validate.ts";
import { deletedEmail, type Email } from "./email.ts";

/** "March 14, 2027", as the app writes dates, for a gift's start day (a calendar date, so read in UTC). */
const longDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const METHODS = "POST";

export interface Subscription {
  plan_id: string;
  status: "active" | "paused" | "cancelled" | "past_due";
  /** Monthly, or yearly (a year from the day it started, at ten times the monthly price). */
  billing_interval: BillingInterval;
  /** Null only for a complimentary membership, which is never billed. */
  billing_day: number | null;
  /** Ending: no renewal after the date it ends (cancel_at). */
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  /** When an ending membership ends: the period's end, or a month later after a cancellation with under 48 hours' notice. */
  cancel_at: string | null;
  /** A staff member's membership: set by the database from any staff role, never billed. */
  complimentary: boolean;
  /** The end of a gift's free months, while they last. */
  gift_until: string | null;
  /** The end of a first membership's free week, while it lasts. */
  trial_until?: string | null;
  /** The plan a yearly membership moves to, monthly, at renewal (cancelling drops it). */
  switch_to_monthly?: string | null;
  /** Set once the member pays through Stripe Checkout. */
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

export type SubscriptionPatch = Partial<
  Pick<Subscription, "status" | "cancel_at_period_end" | "current_period_end" | "cancel_at" | "billing_day" | "gift_until" | "switch_to_monthly">
>;

export interface Gift {
  id: string;
  /** A gift membership (plan and months) or a gift card (credit_cents). */
  kind?: "membership" | "credit";
  plan_id: PlanId | null;
  months: number | null;
  credit_cents?: number | null;
  redeemed_at: string | null;
  /** The first day it can be redeemed ("YYYY-MM-DD"); null from the day it was bought. */
  starts_on: string | null;
  /** LiteraryWorm books it comes with (catalog ids), added to the redeemer's library. */
  books: string[];
}

/** Gift codes (gift_codes): found by code, and claimed by one account at a time. */
export interface Gifts {
  find: (code: string) => Promise<Gift | null>;
  /** Marks the gift redeemed by the account; false when someone else got there first. */
  claim: (giftId: string, userId: string) => Promise<boolean>;
  /** Undoes a claim when Stripe couldn't apply the gift, so the code still works. */
  release: (giftId: string) => Promise<void>;
  /** Adds the gift's books to the account's library as Want to read, leaving any already there as they are. */
  addBooks: (userId: string, books: string[]) => Promise<void>;
}

/** Changes to the member's Stripe subscription. */
export interface Billing {
  pause: (subscriptionId: string) => Promise<void>;
  resume: (subscriptionId: string) => Promise<void>;
  setCancelAtPeriodEnd: (subscriptionId: string, cancel: boolean) => Promise<void>;
  /** Ends the subscription at `at` (unix seconds, a period's end), with no proration. */
  cancelAt: (subscriptionId: string, at: number) => Promise<void>;
  /** Removes a cancellation set with cancelAt. */
  clearCancelAt: (subscriptionId: string) => Promise<void>;
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
  /** A customer balance credit (taken off the next invoices), once per idempotency key. */
  credit: (customerId: string, cents: number, idempotencyKey: string, description: string) => Promise<void>;
}

/** Why members cancel, and the once-per-account month's credit offered instead. */
export interface Retention {
  /** Keeps the member's answer (cancellation_feedback). */
  record: (userId: string, answer: CancelAnswer, outcome: "cancelled" | "kept", sub: Subscription) => Promise<void>;
  /** Whether the account has had the credit already (save_offer_credits). */
  creditUsed: (userId: string) => Promise<boolean>;
  /** Claims the credit; false when the account has had it. */
  claimCredit: (userId: string, cents: number) => Promise<boolean>;
  /** Hands a claim back when Stripe couldn't credit it. */
  releaseCredit: (userId: string) => Promise<void>;
  /** A month of the plan at its current price (public.plans). */
  monthCents: (planId: string) => Promise<number>;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  confirmPassword: (email: string, password: string) => Promise<void>;
  rateLimit: (userId: string) => Promise<void>;
  getSubscription: (userId: string) => Promise<Subscription | null>;
  updateSubscription: (userId: string, patch: SubscriptionPatch) => Promise<Subscription>;
  deleteUser: (userId: string) => Promise<void>;
  /** Emails the address that its account was deleted (Mailgun). */
  sendEmail: (email: Email) => Promise<void>;
  billing: Billing;
  gifts: Gifts;
  retention: Retention;
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

/**
 * The month's credit is for a member paying through Stripe right now: not during a free week or a
 * gift's free months, not while paused or already ending, and never for staff.
 */
export function creditEligible(sub: Subscription | null): sub is Subscription & { stripe_customer_id: string } {
  return Boolean(
    sub && sub.stripe_subscription_id && sub.stripe_customer_id && sub.status === "active" && !sub.cancel_at_period_end &&
      !sub.complimentary && !sub.gift_until && !sub.trial_until,
  );
}

/** Keeps a member's answer; a failure is only logged, so it never stops what they asked for. */
async function keepAnswer(deps: Deps, userId: string, answer: CancelAnswer | null, outcome: "cancelled" | "kept", sub: Subscription) {
  if (!answer) return;
  try {
    await deps.retention.record(userId, answer, outcome, sub);
  } catch (err) {
    console.error("manage-account: couldn't keep a cancel answer:", err instanceof Error ? err.message : err);
  }
}

async function requireSubscription(deps: Deps, userId: string): Promise<Subscription> {
  const sub = await deps.getSubscription(userId);
  if (!sub) throw new HttpError("not_found", "This account has no plan yet. Choose one first.");
  return sub;
}

/** A paid membership, for pausing, resuming, cancelling and restarting: a staff member's has nothing to change. */
async function requirePaidSubscription(deps: Deps, userId: string): Promise<Subscription & { billing_day: number }> {
  const sub = await requireSubscription(deps, userId);
  if (sub.complimentary || sub.billing_day === null) {
    throw new HttpError("bad_request", "Staff memberships are complimentary and never charged, so there's nothing to pause or cancel.");
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
        if (sub.billing_interval === "year") {
          throw new HttpError("bad_request", "A yearly membership is already paid for the year, so it can't be paused.");
        }
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
        onlyKeys(body, ["action", "reason", "comment", "offer"]);
        const answer = parseCancelAnswer(body);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "cancelled" || sub.cancel_at_period_end) return json(req, METHODS, view(sub));
        const nextBilling = sub.stripe_subscription_id && sub.current_period_end
          ? new Date(sub.current_period_end)
          : nextBillingDate(sub.billing_day, now);
        // Reading continues until the date already paid for. With under 48 hours' notice the next
        // charge still goes through, so that date is a month later; a paused membership isn't
        // charged, so it ends on the billing date whenever it's cancelled.
        const { ends, late } = sub.status === "paused" ? { ends: nextBilling, late: false } : cancellationEnd(nextBilling, now, sub.billing_interval);
        if (sub.stripe_subscription_id) {
          if (late) await deps.billing.cancelAt(sub.stripe_subscription_id, Math.floor(ends.getTime() / 1000));
          else await deps.billing.setCancelAtPeriodEnd(sub.stripe_subscription_id, true);
        }
        const cancelled = await deps.updateSubscription(user.id, {
          status: "active",
          cancel_at_period_end: true,
          current_period_end: nextBilling.toISOString(),
          cancel_at: ends.toISOString(),
          // Stripe drops a scheduled move to monthly when a membership is cancelled.
          switch_to_monthly: null,
        });
        await keepAnswer(deps, user.id, answer, "cancelled", sub);
        return json(req, METHODS, view(cancelled));
      }
      case "save_offer_check": {
        onlyKeys(body, ["action"]);
        const sub = await deps.getSubscription(user.id);
        const open = creditEligible(sub) && !(await deps.retention.creditUsed(user.id));
        return json(req, METHODS, { creditCents: open ? await deps.retention.monthCents(sub!.plan_id) : null });
      }
      case "save_offer": {
        onlyKeys(body, ["action", "reason", "comment"]);
        const answer = parseCancelAnswer({ ...body, offer: "credit" });
        if (!answer) throw new HttpError("bad_request", "Choose a reason first.");
        const sub = await deps.getSubscription(user.id);
        if (!creditEligible(sub)) throw new HttpError("bad_request", "This offer isn't available for your membership.");
        const cents = await deps.retention.monthCents(sub.plan_id);
        if (!(await deps.retention.claimCredit(user.id, cents))) throw new HttpError("bad_request", "You've already had this offer.");
        try {
          await deps.billing.credit(sub.stripe_customer_id, cents, `save-offer-${user.id}`, "A month on us, from LiteraryWorm");
        } catch (err) {
          await deps.retention.releaseCredit(user.id);
          throw err;
        }
        await keepAnswer(deps, user.id, answer, "kept", sub);
        return json(req, METHODS, { creditCents: cents });
      }
      case "cancel_feedback": {
        onlyKeys(body, ["action", "reason", "comment", "offer"]);
        const answer = parseCancelAnswer(body);
        if (!answer?.offer || answer.offer === "credit") throw new HttpError("bad_request", "Say which offer you chose instead.");
        const sub = await requireSubscription(deps, user.id);
        await keepAnswer(deps, user.id, answer, "kept", sub);
        return json(req, METHODS, { ok: true });
      }
      case "restart": {
        onlyKeys(body, ["action"]);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.status === "cancelled") {
          throw new HttpError("bad_request", "This membership has ended. Choose a plan to start again.");
        }
        if (sub.stripe_subscription_id) {
          // A cancellation with under 48 hours' notice set a date past the period's end.
          const late = Boolean(sub.cancel_at && sub.current_period_end && sub.cancel_at > sub.current_period_end);
          if (late) await deps.billing.clearCancelAt(sub.stripe_subscription_id);
          else await deps.billing.setCancelAtPeriodEnd(sub.stripe_subscription_id, false);
          return json(req, METHODS, view(await deps.updateSubscription(user.id, { cancel_at_period_end: false, cancel_at: null })));
        }
        return json(
          req,
          METHODS,
          view(await deps.updateSubscription(user.id, { cancel_at_period_end: false, current_period_end: null, cancel_at: null })),
        );
      }
      case "billing_day": {
        onlyKeys(body, ["action", "billingDay"]);
        const day = parseInt(body.billingDay, "billingDay", 1, 28);
        const sub = await requirePaidSubscription(deps, user.id);
        if (sub.billing_interval === "year") {
          throw new HttpError("bad_request", "A yearly membership renews on the date it started, so its billing day can't be changed.");
        }
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
        if (!giftStarted(gift.starts_on, now)) {
          throw new HttpError("bad_request", `This gift starts on ${longDate(gift.starts_on!)}. Redeem it from then.`);
        }
        if (gift.kind === "credit") {
          const cents = gift.credit_cents ?? 0;
          if (cents <= 0) throw new HttpError("bad_request", "That gift code isn't valid or has already been used.");
          if (!(await deps.gifts.claim(gift.id, user.id))) {
            throw new HttpError("bad_request", "That gift code isn't valid or has already been used.");
          }
          // Only a failure before Stripe has the credit gives the code back.
          try {
            const customerId = await deps.customerFor(user.id, user.email);
            await deps.billing.credit(customerId, cents, `gift-card-${gift.id}`, "LiteraryWorm gift card");
          } catch (err) {
            await deps.gifts.release(gift.id);
            throw err;
          }
          return json(req, METHODS, { gift: { kind: "credit", creditCents: cents } });
        }
        if (!gift.plan_id || !gift.months) throw new HttpError("bad_request", "That gift code isn't valid or has already been used.");
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
        const given = { planId: gift.plan_id, months: gift.months, until: until.toISOString(), books: gift.books ?? [] };
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
        // The books are a bonus: the gift is redeemed either way, so a failure here is only logged.
        if (given.books.length) {
          await deps.gifts.addBooks(user.id, given.books).catch((err) => console.error("manage-account: couldn't add a gift's books", (err as Error).message));
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
        const cancelling = Boolean(sub && !sub.complimentary && sub.status !== "cancelled");
        if (sub && cancelling) {
          if (sub.stripe_subscription_id) await deps.billing.cancelNow(sub.stripe_subscription_id);
          await deps.updateSubscription(user.id, { status: "cancelled", cancel_at_period_end: false, current_period_end: now.toISOString() });
        }
        await deps.deleteUser(user.id);
        // The account has gone either way: a confirmation that doesn't send is logged, not an error.
        await deps.sendEmail(deletedEmail(user.email, cancelling)).catch((err) => console.error("manage-account: the deletion email didn't send", err));
        return json(req, METHODS, { deleted: true });
      }
      default:
        throw new HttpError("bad_request", "Unknown action.");
    }
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
