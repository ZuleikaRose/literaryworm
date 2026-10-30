// Stripe for the billing functions. The key comes from the STRIPE_SECRET_KEY function setting
// (ideally a restricted key, rk_, with only the permissions these functions use); nothing is
// hard-coded. Prices are found by lookup key, so the same code works in test and live mode.

import Stripe from "npm:stripe@23.0.0";

export { Stripe };

export const STRIPE_API_VERSION = "2026-09-30.endive";

export type PlanId = "basic" | "standard" | "premium";
export const PLANS: PlanId[] = ["basic", "standard", "premium"];

/** How often a membership is billed: monthly, or yearly at ten times the monthly price. */
export type BillingInterval = "month" | "year";
export const INTERVALS: BillingInterval[] = ["month", "year"];

/** Each plan's price's lookup key in Stripe, monthly and yearly. */
export const PRICE_LOOKUP_KEY: Record<BillingInterval, Record<PlanId, string>> = {
  month: {
    basic: "literaryworm_basic_monthly",
    standard: "literaryworm_standard_monthly",
    premium: "literaryworm_premium_monthly",
  },
  year: {
    basic: "literaryworm_basic_yearly",
    standard: "literaryworm_standard_yearly",
    premium: "literaryworm_premium_yearly",
  },
};

/** How many months a gift can be bought for. */
export const GIFT_MONTHS = [1, 3, 6, 12] as const;
export type GiftMonths = (typeof GIFT_MONTHS)[number];

/** Plan names as members see them. */
export const PLAN_NAMES: Record<PlanId, string> = { basic: "Basic", standard: "Standard", premium: "Premium" };

// 32 letters and digits with no 0/O or 1/I, so a code read aloud or copied by hand stays right.
const GIFT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new gift code: 16 characters, 80 random bits (each byte maps evenly onto the 32 characters). */
export function giftCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => GIFT_ALPHABET[b % 32]).join("");
}

/**
 * `months` after `from` (midnight UTC), as the date the gift's free months run to. Billing days
 * run 1–28, so a date on the 29th to 31st moves on to the 1st of the next month (a few days more,
 * never fewer).
 */
export function addGiftMonths(from: Date, months: number): Date {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()));
  // Date.UTC rolls an overlong day into the next month (31 January + 1 month is 3 March).
  const intended = (from.getUTCMonth() + months) % 12;
  if (date.getUTCMonth() !== intended || date.getUTCDate() > 28) {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months + 1, 1));
  }
  return date;
}

/** Members must cancel at least this long before the next billing date to stop that charge (the Terms). */
export const CANCEL_NOTICE_HOURS = 48;

/** The same day and time a month later; a day the next month doesn't have becomes its last day, as Stripe renews. */
export function oneMonthAfter(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(from.getUTCDate(), lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds()),
  );
}

/** The same day and time a year later; 29 February becomes 28 February, as Stripe renews. */
export function oneYearAfter(from: Date): Date {
  const year = from.getUTCFullYear() + 1;
  const lastDay = new Date(Date.UTC(year, from.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, from.getUTCMonth(), Math.min(from.getUTCDate(), lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds()),
  );
}

/**
 * When a membership cancelled at `now` ends, given its next billing date. With at least 48 hours'
 * notice it ends then and nothing more is charged; with less, that charge still goes through and
 * the membership ends a period later (a month, or a year when billed yearly), at the end of the
 * period it paid for. No refunds either way.
 */
export function cancellationEnd(nextBilling: Date, now: Date, interval: BillingInterval = "month"): { ends: Date; late: boolean } {
  if (nextBilling.getTime() - now.getTime() >= CANCEL_NOTICE_HOURS * 3_600_000) return { ends: nextBilling, late: false };
  return { ends: interval === "year" ? oneYearAfter(nextBilling) : oneMonthAfter(nextBilling), late: true };
}

/** The plan and billing interval a price's lookup key stands for. */
export function planForLookupKey(key: string | null | undefined): { plan: PlanId; interval: BillingInterval } | null {
  for (const interval of INTERVALS) {
    const plan = PLANS.find((p) => PRICE_LOOKUP_KEY[interval][p] === key);
    if (plan) return { plan, interval };
  }
  return null;
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let client: Stripe | null = null;

/** One Stripe client per function instance, using fetch (Deno has no Node http). */
export function stripeClient(): Stripe {
  client ??= new Stripe(env("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
  return client;
}

/** Checks a webhook's signature with STRIPE_WEBHOOK_SECRET and returns the event. */
export function verifyWebhook(body: string, signature: string): Promise<Stripe.Event> {
  return stripeClient().webhooks.constructEventAsync(
    body,
    signature,
    env("STRIPE_WEBHOOK_SECRET"),
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}

/**
 * The next time the billing day comes round (midnight UTC), strictly after `from`.
 * Days run 1–28 so every month has one.
 */
export function nextBillingDay(day: number, from: Date): Date {
  const thisMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day));
  return thisMonth > from ? thisMonth : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day));
}

/** Our status for a Stripe subscription. Paused collection counts as paused. */
export function statusFor(sub: Stripe.Subscription): "active" | "paused" | "cancelled" | "past_due" {
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return "cancelled";
  if (sub.pause_collection || sub.status === "paused") return "paused";
  if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete") return "past_due";
  return "active";
}

/** A promo code on a membership, as the member sees it (no Stripe ids). */
export interface DiscountView {
  code: string | null;
  percentOff: number | null;
  /** In the currency's smallest unit (cents). */
  amountOff: number | null;
  currency: string | null;
  duration: (typeof DURATIONS)[number];
  /** When a repeating discount stops; null for once and forever. */
  ends: string | null;
}

const DURATIONS = ["once", "repeating", "forever"] as const;
const INVOICE_STATUSES = ["paid", "open", "void", "uncollectible"] as const;

/** The subscription's discount, from `discounts` expanded with `.source.coupon` and `.promotion_code`. */
export function discountView(discounts: Array<string | Stripe.Discount>): DiscountView | null {
  const discount = discounts.find((d): d is Stripe.Discount => typeof d !== "string");
  const coupon = discount?.source.coupon;
  if (!discount || !coupon || typeof coupon === "string") return null;
  const duration = DURATIONS.find((d) => d === coupon.duration);
  if (!duration) return null;
  const promo = discount.promotion_code;
  return {
    code: promo && typeof promo !== "string" ? promo.code : null,
    percentOff: coupon.percent_off,
    amountOff: coupon.amount_off,
    currency: coupon.currency,
    duration,
    ends: discount.end ? new Date(discount.end * 1000).toISOString() : null,
  };
}

/** One charge in the billing history: amounts in the currency's smallest unit (cents). */
export interface InvoiceView {
  date: string;
  amount: number;
  currency: string;
  status: (typeof INVOICE_STATUSES)[number];
  /** How much promo codes took off this charge. */
  discount: number;
  /** Stripe's hosted page for the invoice and its receipt. */
  url: string | null;
}

/** A finalised invoice as the member sees it; drafts (not yet sent) are left out. */
export function invoiceView(invoice: Stripe.Invoice): InvoiceView | null {
  // Drafts aren't sent yet; anything Stripe adds later is left out too.
  const status = INVOICE_STATUSES.find((s) => s === invoice.status);
  if (!status) return null;
  const paidAt = invoice.status_transitions?.paid_at;
  return {
    date: new Date((paidAt ?? invoice.created) * 1000).toISOString(),
    amount: status === "paid" ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency,
    status,
    discount: (invoice.total_discount_amounts ?? []).reduce((sum, d) => sum + d.amount, 0),
    url: invoice.hosted_invoice_url ?? null,
  };
}

/** The fields public.subscriptions keeps for a Stripe subscription. */
/**
 * Set on a yearly subscription (by checkout, and by its schedule's current phase) while it waits to
 * move to monthly billing at renewal: the plan it moves to. The schedule's monthly phase unsets it.
 */
export const SWITCH_KEY = "switch_to_monthly";

const scheduleId = (sub: Stripe.Subscription) => (sub.schedule ? (typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id) : null);

/**
 * Drops a scheduled move to monthly: releases the subscription from its schedule (the year carries
 * on as it is) and clears the key. Stripe refuses cancellations on a scheduled subscription, so
 * cancelling calls this first.
 */
export async function releaseSchedule(stripe: Stripe, subscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const id = scheduleId(sub);
  if (id) await stripe.subscriptionSchedules.release(id);
  if (sub.metadata?.[SWITCH_KEY]) await stripe.subscriptions.update(subscriptionId, { metadata: { [SWITCH_KEY]: "" } });
}

/**
 * Schedules a yearly subscription to move to `monthlyPriceId` when its year ends: phase one is the
 * current year as it is (items, dates, discounts), phase two one month at the monthly price, then
 * the schedule lets go and the subscription carries on monthly. Nothing is charged or credited now.
 */
export async function scheduleMonthly(stripe: Stripe, subscriptionId: string, planId: string, monthlyPriceId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const existing = scheduleId(sub);
  const schedule = existing
    ? await stripe.subscriptionSchedules.retrieve(existing)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const startedAt = schedule.current_phase?.start_date;
  const phase = schedule.phases.find((p) => p.start_date === startedAt) ?? schedule.phases[0];
  const idOf = (x: string | { id: string } | null | undefined) => (x ? (typeof x === "string" ? x : x.id) : undefined);
  try {
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: phase.items.map((i) => ({ price: idOf(i.price)!, quantity: i.quantity ?? 1 })),
          start_date: phase.start_date,
          end_date: phase.end_date,
          // Kept as they are (Stripe unsets anything a phase leaves out).
          discounts: (phase.discounts ?? []).map((d) =>
            d.discount ? { discount: idOf(d.discount) } : d.promotion_code ? { promotion_code: idOf(d.promotion_code) } : { coupon: idOf(d.coupon) }
          ),
          metadata: { ...(phase.metadata ?? {}), [SWITCH_KEY]: planId },
          proration_behavior: "none",
        },
        {
          items: [{ price: monthlyPriceId, quantity: 1 }],
          duration: { interval: "month", interval_count: 1 },
          metadata: { plan_id: planId, interval: "month", [SWITCH_KEY]: "" },
          proration_behavior: "none",
        },
      ],
    } as Stripe.SubscriptionScheduleUpdateParams);
    // The current phase's metadata reaches the subscription only when a phase starts; set it now too.
    await stripe.subscriptions.update(subscriptionId, { metadata: { [SWITCH_KEY]: planId } });
  } catch (err) {
    // Half done is worse than not done (a switch the member can't see, or one shown that won't
    // happen): let the subscription go from the schedule, then report the failure.
    await releaseSchedule(stripe, subscriptionId).catch((undo) => console.error("scheduleMonthly: couldn't undo", undo));
    throw err;
  }
}

export function subscriptionRow(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const price = planForLookupKey(item?.price.lookup_key);
  if (!price) throw new Error(`Subscription ${sub.id} has a price with no LiteraryWorm plan`);
  const periodEnd = item.current_period_end;
  // Set by manage-account when a gift's free months are applied; shown only while they last.
  const giftUntil = Number(sub.metadata?.gift_until);
  return {
    plan_id: price.plan,
    billing_interval: price.interval,
    status: statusFor(sub),
    gift_until: sub.status === "trialing" && giftUntil > 0 ? new Date(giftUntil * 1000).toISOString() : null,
    // Days run 1–28; a yearly membership that started on the 29th to 31st keeps its renewal date
    // (current_period_end), and its billing day is only a label, as it can't be moved.
    billing_day: Math.min(new Date(sub.billing_cycle_anchor * 1000).getUTCDate(), 28),
    // "Ending": at the period's end, or on a later date set for a cancellation with under 48 hours' notice.
    cancel_at_period_end: sub.cancel_at_period_end || Boolean(sub.cancel_at),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // When an ending membership ends.
    cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : sub.cancel_at_period_end && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // A yearly membership waiting to move to monthly at renewal, while its schedule is attached.
    switch_to_monthly: price.interval === "year" && scheduleId(sub) && PLANS.includes(sub.metadata?.[SWITCH_KEY] as PlanId)
      ? sub.metadata[SWITCH_KEY]
      : null,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}
