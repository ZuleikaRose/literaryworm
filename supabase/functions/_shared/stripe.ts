// Stripe for the billing functions. The key comes from the STRIPE_SECRET_KEY function setting
// (ideally a restricted key, rk_, with only the permissions these functions use); nothing is
// hard-coded. Prices are found by lookup key, so the same code works in test and live mode.

import Stripe from "npm:stripe@23.0.0";

export { Stripe };

export const STRIPE_API_VERSION = "2026-09-30.endive";

export type PlanId = "basic" | "standard" | "premium";
export const PLANS: PlanId[] = ["basic", "standard", "premium"];

/** The monthly price's lookup key in Stripe, for each plan. */
export const PRICE_LOOKUP_KEY: Record<PlanId, string> = {
  basic: "literaryworm_basic_monthly",
  standard: "literaryworm_standard_monthly",
  premium: "literaryworm_premium_monthly",
};

export function planForLookupKey(key: string | null | undefined): PlanId | null {
  return (Object.keys(PRICE_LOOKUP_KEY) as PlanId[]).find((p) => PRICE_LOOKUP_KEY[p] === key) ?? null;
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

/** The fields public.subscriptions keeps for a Stripe subscription. */
export function subscriptionRow(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const plan = planForLookupKey(item?.price.lookup_key);
  if (!plan) throw new Error(`Subscription ${sub.id} has a price with no LiteraryWorm plan`);
  const periodEnd = item.current_period_end;
  return {
    plan_id: plan,
    status: statusFor(sub),
    billing_day: new Date(sub.billing_cycle_anchor * 1000).getUTCDate(),
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}
