// The account's Stripe Customer and the plans' prices, for the billing functions.

import { type BillingInterval, PRICE_LOOKUP_KEY, type PlanId, stripeClient } from "./stripe.ts";
import { serviceClient } from "./supabase.ts";

/** The account's Stripe Customer, created (and remembered in stripe_customers) the first time. */
export async function customerFor(userId: string, email: string | undefined): Promise<string> {
  const db = serviceClient();
  const { data, error } = await db.from("stripe_customers").select("customer_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data.customer_id;
  // The idempotency key stops a double click creating two customers.
  const customer = await stripeClient().customers.create({ email, metadata: { user_id: userId } }, { idempotencyKey: `customer-${userId}` });
  const { error: saveError } = await db.from("stripe_customers").insert({ user_id: userId, customer_id: customer.id });
  if (saveError) throw saveError;
  return customer.id;
}

/** The plan's active monthly (or yearly) price in Stripe, found by lookup key. */
export async function planPrice(
  planId: PlanId,
  interval: BillingInterval,
): Promise<{ id: string; amount: number; currency: string; product: string }> {
  const { data } = await stripeClient().prices.list({ lookup_keys: [PRICE_LOOKUP_KEY[interval][planId]], active: true, limit: 1 });
  const price = data[0];
  if (!price || price.unit_amount === null) throw new Error(`No active ${interval}ly Stripe price for ${planId}`);
  const product = typeof price.product === "string" ? price.product : price.product.id;
  return { id: price.id, amount: price.unit_amount, currency: price.currency, product };
}

/** The plan's monthly price: what gifts are priced from. */
export const monthlyPrice = (planId: PlanId) => planPrice(planId, "month");
