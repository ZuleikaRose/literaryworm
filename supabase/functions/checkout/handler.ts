// POST /functions/v1/checkout — start a membership, change plan, or buy a gift.
// Requires a signed-in account (JWT). Subscriptions are never written from the browser.
//
//   { planId: "basic" | "standard" | "premium", interval?: "month" | "year", billingDay: 1-28,
//     renewalTermsAccepted: true, setup?: true }
//
// interval is "month" unless given. Yearly costs ten times the monthly price and starts the day it's
// bought (billingDay isn't needed); it renews on that date each year.
//   { gift: true, planId, months: 1 | 3 | 6 | 12, startsOn?: "YYYY-MM-DD", recipientEmail?, message?, books?: [catalog ids, up to 10] }
//   { voiceHours: 5 | 10 }                  more natural-voice hours, paid once (a paid-up membership,
//                                            not in the free week; stripe-webhook adds the pack)
//   { gift: true, credit: 2500 | 5000 | 10000, startsOn?, recipientEmail?, message? }
//                                            a gift card: that much credit for a membership, added
//                                            to the redeemer's Stripe balance (no books)
//
// A gift is a one-off payment on Stripe Checkout (months × the plan's monthly price, or the
// yearly price for 12 months, nothing recurring): this returns { url }, and once Stripe confirms payment the stripe-webhook function
// makes the gift code, which the buyer sees in /gifts. Stripe sends them back to /gifts?checkout=success.
// startsOn (up to a year ahead, for a birthday say) is the first day the code can be redeemed.
// recipientEmail (and an optional message of up to 300 characters) has the gift-reminders
// function email the code to someone once it can be redeemed, instead of the buyer passing it on.
//
// Stripe sends the member back to /pricing?checkout=success (with &setup=1 during sign-up), where
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
import { CATALOG } from "../_shared/catalog.ts";
import { isVoicePack, type VoicePackHours, type BillingInterval, GIFT_CARD_CENTS, type GiftCardCents, GIFT_MONTHS, type GiftMonths, INTERVALS, nextBillingDay, parseGiftBooks, parseGiftMessage, parseGiftRecipient, parseGiftStart, PLANS, type PlanId, tooBigFor } from "../_shared/stripe.ts";
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
  /** While a first membership's free week lasts: when it ends. */
  trial_until?: string | null;
}

export interface VoiceCheckoutInput {
  customerId: string;
  userId: string;
  hours: VoicePackHours;
  origin: string;
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
  /** Free days before the first charge: FREE_TRIAL_DAYS for a first membership, else 0. */
  trialDays: number;
}

/** A first membership starts with this many free days; cancelling before they end costs nothing. */
export const FREE_TRIAL_DAYS = 7;

export interface GiftCheckoutInput {
  customerId: string;
  userId: string;
  /** A gift membership: the plan and months (null for a gift card). */
  planId: PlanId | null;
  months: GiftMonths | null;
  /** A gift card: the credit in cents (null for a gift membership). */
  creditCents: GiftCardCents | null;
  /** A gift of natural-voice hours (5 or 10); null for the other gifts. */
  voiceHours?: VoicePackHours | null;
  /** The first day the code can be redeemed ("YYYY-MM-DD"); null for straight away. */
  startsOn: string | null;
  /** Who to email the code to, and what the buyer wrote; null when the buyer passes it on. */
  recipientEmail: string | null;
  message: string | null;
  /** LiteraryWorm books that come with the gift (catalog ids, up to GIFT_BOOKS_MAX). */
  books: string[];
  origin: string;
}

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  rateLimit: (userId: string) => Promise<void>;
  /** Whether the account holds any staff role. */
  isStaff: (userId: string) => Promise<boolean>;
  getMembership: (userId: string) => Promise<Membership | null>;
  /** How many profiles the account has, and how many devices hold Read offline places. */
  householdSize: (userId: string) => Promise<{ profiles: number; offlineDevices: number }>;
  /** The account's Stripe Customer, created (and remembered) the first time. */
  customerFor: (userId: string, email: string | undefined) => Promise<string>;
  createCheckout: (input: CheckoutInput) => Promise<string>;
  createGiftCheckout: (input: GiftCheckoutInput) => Promise<string>;
  /** A one-off Checkout for more natural-voice hours (VOICE_PACKS). */
  createVoiceCheckout: (input: VoiceCheckoutInput) => Promise<string>;
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
    // Hours for yourself; a gift of hours (gift: true) is handled with the other gifts below.
    if (body.voiceHours !== undefined && body.gift === undefined) {
      onlyKeys(body, ["voiceHours"]);
      if (!isVoicePack(body.voiceHours)) throw new HttpError("bad_request", "Pick 5 or 10 hours.");
      // More hours go with a membership that's paid up: not in the free week, nor while a payment is owed.
      const membership = await deps.getMembership(user.id);
      if (!membership || membership.status !== "active") {
        throw new HttpError("bad_request", "More natural-voice hours go with an active membership.");
      }
      const now = deps.now?.() ?? new Date();
      if (membership.trial_until && Date.parse(membership.trial_until) > now.getTime()) {
        throw new HttpError("bad_request", "More hours can be bought once your free week ends and the membership is paid for.");
      }
      const customerId = await deps.customerFor(user.id, user.email);
      const url = await deps.createVoiceCheckout({ customerId, userId: user.id, hours: body.voiceHours, origin: deps.siteOrigin(req) });
      return json(req, METHODS, { url });
    }
    if (body.gift !== undefined) {
      onlyKeys(body, ["gift", "planId", "months", "credit", "voiceHours", "startsOn", "recipientEmail", "message", "books"]);
      if (body.gift !== true) throw new HttpError("bad_request", "gift is true when buying a gift.");
      // Natural-voice hours as a gift: the same packs, redeemed into the recipient's account.
      const voices = body.voiceHours !== undefined;
      if (voices && (body.credit !== undefined || body.planId !== undefined || body.months !== undefined || body.books !== undefined || !isVoicePack(body.voiceHours))) {
        throw new HttpError("bad_request", "A gift of natural-voice hours is 5 or 10 hours: no plan, months, credit or books.");
      }
      const card = body.credit !== undefined;
      if (voices) {
        // Checked above.
      } else if (card) {
        if (body.planId !== undefined || body.months !== undefined || body.books !== undefined) {
          throw new HttpError("bad_request", "A gift card is an amount of credit: no plan, months or books.");
        }
        if (typeof body.credit !== "number" || !GIFT_CARD_CENTS.includes(body.credit as GiftCardCents)) {
          throw new HttpError("bad_request", "Pick a $25, $50 or $100 gift card.");
        }
      } else {
        if (typeof body.planId !== "string" || !PLANS.includes(body.planId as PlanId)) {
          throw new HttpError("bad_request", "Pick Basic, Standard or Premium.");
        }
        if (typeof body.months !== "number" || !GIFT_MONTHS.includes(body.months as GiftMonths)) {
          throw new HttpError("bad_request", "Pick 1, 3, 6 or 12 months.");
        }
      }
      let startsOn: string | null;
      let recipientEmail: string | null;
      let message: string | null;
      let books: string[];
      try {
        startsOn = parseGiftStart(body.startsOn);
        recipientEmail = parseGiftRecipient(body.recipientEmail);
        message = parseGiftMessage(body.message);
        books = parseGiftBooks(body.books, (id) => id in CATALOG);
      } catch (err) {
        throw new HttpError("bad_request", (err as Error).message);
      }
      if (message !== null && recipientEmail === null) throw new HttpError("bad_request", "A message goes with a gift sent by email.");
      const customerId = await deps.customerFor(user.id, user.email);
      const url = await deps.createGiftCheckout({
        customerId,
        userId: user.id,
        planId: card || voices ? null : (body.planId as PlanId),
        months: card || voices ? null : (body.months as GiftMonths),
        creditCents: card ? (body.credit as GiftCardCents) : null,
        voiceHours: voices ? (body.voiceHours as VoicePackHours) : null,
        startsOn,
        recipientEmail,
        message,
        books,
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

    // A smaller plan (or a new one after a lapse) needs the household to fit it first.
    const problems = tooBigFor(planId, await deps.householdSize(user.id));
    if (problems.length > 0) throw new HttpError("bad_request", problems.join(" "));

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

    // A first membership (no membership before, ever) starts with a free week; its first charge, and
    // its billing day after that, is the day the week ends.
    const trialDays = membership === null ? FREE_TRIAL_DAYS : 0;
    const anchor = trialDays > 0 || interval === "year" || now.getUTCDate() === billingDay
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
      trialDays,
    });
    return json(req, METHODS, { url });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
