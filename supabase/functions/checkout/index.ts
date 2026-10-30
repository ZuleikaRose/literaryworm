import { allowedOrigins } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { type PlanId, stripeClient } from "../_shared/stripe.ts";
import { customerFor, monthlyPrice } from "../_shared/stripeCustomers.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { type CheckoutInput, type GiftCheckoutInput, handle, type Membership } from "./handler.ts";

const PRICES: Record<PlanId, string> = { basic: "$7.99", standard: "$12.99", premium: "$17.99" };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const priceId = async (planId: PlanId) => (await monthlyPrice(planId)).id;

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
        .select("plan_id, status, stripe_subscription_id")
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
        line_items: [{ price: await priceId(input.planId), quantity: 1 }],
        // A box for Stripe promotion codes on the payment page.
        allow_promotion_codes: true,
        subscription_data: {
          ...(input.billingCycleAnchor ? { billing_cycle_anchor: input.billingCycleAnchor, proration_behavior: "create_prorations" as const } : {}),
          metadata: { plan_id: input.planId },
        },
        custom_text: {
          submit: {
            message: `Your membership renews automatically every month on the ${ordinal(input.billingDay)} at ${PRICES[input.planId]} until you cancel, which you can do at any time in Account. All sales are final.`,
          },
        },
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
    async changePlan(subscriptionId, planId) {
      const stripe = stripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: sub.items.data[0].id, price: await priceId(planId) }],
        proration_behavior: "none",
      });
    },
    siteOrigin(req) {
      const origins = allowedOrigins();
      const origin = req.headers.get("Origin");
      return origin && origins.includes(origin) ? origin : (origins.find((o) => o.startsWith("https://www.")) ?? origins[0]);
    },
  })
);
