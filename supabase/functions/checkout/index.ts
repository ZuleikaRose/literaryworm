import { allowedOrigins } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { PRICE_LOOKUP_KEY, type PlanId, stripeClient } from "../_shared/stripe.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { type CheckoutInput, handle, type Membership } from "./handler.ts";

const PRICES: Record<PlanId, string> = { basic: "$7.99", standard: "$12.99", premium: "$17.99" };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

async function priceId(planId: PlanId): Promise<string> {
  const { data } = await stripeClient().prices.list({ lookup_keys: [PRICE_LOOKUP_KEY[planId]], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No active Stripe price for ${planId}`);
  return data[0].id;
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
    async isAdmin(userId) {
      const { data, error } = await serviceClient().from("staff_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (error) throw error;
      return data !== null;
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
    async customerFor(userId, email) {
      const db = serviceClient();
      const { data, error } = await db.from("stripe_customers").select("customer_id").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (data) return data.customer_id;
      // The idempotency key stops a double click creating two customers.
      const customer = await stripeClient().customers.create({ email, metadata: { user_id: userId } }, { idempotencyKey: `customer-${userId}` });
      const { error: saveError } = await db.from("stripe_customers").insert({ user_id: userId, customer_id: customer.id });
      if (saveError) throw saveError;
      return customer.id;
    },
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
