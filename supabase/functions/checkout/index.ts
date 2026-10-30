import { allowedOrigins } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { type BillingInterval, type PlanId, releaseSchedule, scheduleMonthly, stripeClient } from "../_shared/stripe.ts";
import { customerFor, monthlyPrice, planPrice } from "../_shared/stripeCustomers.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { type CheckoutInput, type GiftCheckoutInput, handle, type Membership } from "./handler.ts";

const PRICES: Record<BillingInterval, Record<PlanId, string>> = {
  month: { basic: "$7.99", standard: "$12.99", premium: "$17.99" },
  year: { basic: "$79.90", standard: "$129.90", premium: "$179.90" },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const priceId = async (planId: PlanId, interval: BillingInterval) => (await planPrice(planId, interval)).id;

/** The renewal terms shown under Stripe's pay button. */
function renewalMessage(input: CheckoutInput): string {
  const price = PRICES[input.interval][input.planId];
  if (input.interval === "year") {
    const today = new Date();
    return `Your membership renews automatically every year on ${MONTHS[today.getUTCMonth()]} ${ordinal(today.getUTCDate())} at ${price} until you cancel, which you can do at any time in Account. All sales are final.`;
  }
  return `Your membership renews automatically every month on the ${ordinal(input.billingDay)} at ${price} until you cancel, which you can do at any time in Account. All sales are final.`;
}

/** Eight random letters, as Stripe asks for in an integration identifier. */
function randomLetters(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => String.fromCharCode(97 + (b % 26))).join("");
}

Deno.serve((req) =>
  handle(req, {
    requireUser,
    rateLimit: (userId) => enforceRateLimit(`checkout:${userId}`, 10, 60),
    // Any staff role: everyone on staff has a complimentary membership.
    async isStaff(userId) {
      const { data, error } = await serviceClient().from("staff_roles").select("role").eq("user_id", userId).limit(1);
      if (error) throw error;
      return data.length > 0;
    },
    async getMembership(userId) {
      const { data, error } = await serviceClient()
        .from("subscriptions")
        .select("plan_id, status, billing_interval, stripe_subscription_id, cancel_at_period_end, current_period_end, switch_to_monthly")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as Membership | null;
    },
    customerFor,
    async createCheckout(input: CheckoutInput) {
      const session = await stripeClient().checkout.sessions.create({
        mode: "subscription",
        customer: input.customerId,
        client_reference_id: input.userId,
        line_items: [{ price: await priceId(input.planId, input.interval), quantity: 1 }],
        // A box for Stripe promotion codes on the payment page.
        allow_promotion_codes: true,
        subscription_data: {
          ...(input.billingCycleAnchor ? { billing_cycle_anchor: input.billingCycleAnchor, proration_behavior: "create_prorations" as const } : {}),
          metadata: { plan_id: input.planId, interval: input.interval },
        },
        custom_text: { submit: { message: renewalMessage(input) } },
        success_url: `${input.origin}/plans?checkout=success${input.setup ? "&setup=1" : ""}`,
        cancel_url: `${input.origin}/plans?checkout=cancelled`,
        integration_identifier: `literaryworm_membership_${randomLetters()}`,
      });
      if (!session.url) throw new Error("Stripe returned no Checkout URL");
      return session.url;
    },
    async createGiftCheckout(input: GiftCheckoutInput) {
      const price = await monthlyPrice(input.planId);
      const session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        customer: input.customerId,
        client_reference_id: input.userId,
        // The plan's own product and monthly price, once for each month: so the page reads
        // "LiteraryWorm Standard × 3", and a gift is taxed exactly like the membership it buys.
        // No custom_text: accounts with Stripe Managed Payments refuse it (the Gifts page has the terms).
        line_items: [{ quantity: input.months, price_data: { currency: price.currency, unit_amount: price.amount, product: price.product } }],
        // Read by stripe-webhook to make the gift code.
        metadata: { kind: "gift", plan_id: input.planId, months: String(input.months) },
        success_url: `${input.origin}/gifts?checkout=success`,
        cancel_url: `${input.origin}/gifts?checkout=cancelled`,
        integration_identifier: `literaryworm_gift_${randomLetters()}`,
      });
      if (!session.url) throw new Error("Stripe returned no Checkout URL");
      return session.url;
    },
    async changePlan(subscriptionId, planId, interval, from) {
      const stripe = stripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const item = sub.items.data[0];
      const price = await planPrice(planId, interval);
      if (from === "month" && interval === "year") {
        // The year starts now and is charged now, less the unused part of the month.
        await stripe.subscriptions.update(subscriptionId, {
          items: [{ id: item.id, price: price.id }],
          billing_cycle_anchor: "now",
          proration_behavior: "always_invoice",
        });
        return;
      }
      // A dearer yearly plan is charged the difference for the rest of the year today; otherwise the
      // new price applies from the next renewal, with no partial charges or credits.
      const upgrade = interval === "year" && price.amount > (item.price.unit_amount ?? 0);
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, price: price.id }],
        proration_behavior: upgrade ? "always_invoice" : "none",
      });
    },
    async scheduleMonthly(subscriptionId, planId) {
      await scheduleMonthly(stripeClient(), subscriptionId, planId, (await planPrice(planId, "month")).id);
    },
    keepYearly: (subscriptionId) => releaseSchedule(stripeClient(), subscriptionId),
    siteOrigin(req) {
      const origins = allowedOrigins();
      const origin = req.headers.get("Origin");
      return origin && origins.includes(origin) ? origin : (origins.find((o) => o.startsWith("https://www.")) ?? origins[0]);
    },
  })
);
