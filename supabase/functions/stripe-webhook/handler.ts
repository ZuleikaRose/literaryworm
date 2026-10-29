// POST /functions/v1/stripe-webhook — Stripe's events, the only way a paid membership is written.
//
// Every event's signature is checked first (STRIPE_WEBHOOK_SECRET). Events are mapped to an
// account through the Stripe Customer (stripe_customers), never through metadata, and each is
// handled once (stripe_events). Admins are never billed: a subscription that reaches an admin's
// customer is cancelled at once, and a renewal invoice drafted for one is deleted before it's paid.
//
// Gifts: a paid gift Checkout (mode payment, metadata.kind "gift") makes a gift code for the buyer,
// once per Checkout Session. A redeemed gift that starts a membership is a Stripe subscription
// carrying metadata.gift_consent_at (the redeemer agreed to the terms for after the gift in
// Account); its first event creates the membership with that consent.
//
// Handled: checkout.session.completed and .async_payment_succeeded (start the membership, or a gift),
// customer.subscription.created/.updated/.deleted and invoice.paid/.payment_failed (keep it in
// step), invoice.created (admins), and charge.dispute.created, charge.refunded and
// radar.early_fraud_warning.created (kept for the team to review). Everything else is ignored.

import type { Stripe } from "../_shared/stripe.ts";
import { GIFT_MONTHS, type GiftMonths, type PlanId, PLANS, subscriptionRow } from "../_shared/stripe.ts";

export type SubscriptionFields = ReturnType<typeof subscriptionRow>;

export interface Deps {
  verify: (body: string, signature: string) => Promise<Stripe.Event>;
  alreadyHandled: (eventId: string) => Promise<boolean>;
  markHandled: (event: Stripe.Event, needsReview: boolean) => Promise<void>;
  userForCustomer: (customerId: string) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  getSubscription: (id: string) => Promise<Stripe.Subscription>;
  /** Creates or replaces the membership; consentAt records when auto-renewal was agreed. */
  startMembership: (userId: string, fields: SubscriptionFields, consentAt: string) => Promise<void>;
  /** Updates an existing membership; false when the account has none yet. */
  updateMembership: (userId: string, fields: SubscriptionFields) => Promise<boolean>;
  cancelNow: (subscriptionId: string) => Promise<void>;
  /** Makes the gift code for a paid gift Checkout; does nothing if it already exists. */
  createGift: (gift: NewGift) => Promise<void>;
  deleteDraftInvoice: (invoiceId: string) => Promise<void>;
}

export interface NewGift {
  sessionId: string;
  buyerId: string | null;
  planId: PlanId;
  months: GiftMonths;
  amountCents: number;
  currency: string;
}

const REVIEW = new Set(["charge.dispute.created", "charge.refunded", "radar.early_fraud_warning.created"]);

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

async function syncSubscription(deps: Deps, sub: Stripe.Subscription): Promise<void> {
  const userId = await deps.userForCustomer(idOf(sub.customer)!);
  if (!userId) {
    console.warn(`stripe-webhook: subscription ${sub.id} has no LiteraryWorm account`);
    return;
  }
  if (await deps.isAdmin(userId)) {
    if (sub.status !== "canceled" && sub.status !== "incomplete_expired") await deps.cancelNow(sub.id);
    return;
  }
  // A membership is created only by a completed Checkout (which records the renewal consent), or
  // by a redeemed gift (whose consent is on the subscription); other events that arrive before
  // it simply wait for it.
  const updated = await deps.updateMembership(userId, subscriptionRow(sub));
  const giftConsent = sub.metadata?.gift_consent_at;
  if (!updated && giftConsent && !Number.isNaN(Date.parse(giftConsent)) && sub.status !== "canceled" && sub.status !== "incomplete_expired") {
    await deps.startMembership(userId, subscriptionRow(sub), new Date(giftConsent).toISOString());
  }
}

async function handleEvent(deps: Deps, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.mode === "payment" && session.metadata?.kind === "gift") {
        if (session.payment_status !== "paid") return;
        const planId = session.metadata.plan_id as PlanId;
        const months = Number(session.metadata.months) as GiftMonths;
        if (!PLANS.includes(planId) || !GIFT_MONTHS.includes(months) || !session.amount_total) {
          throw new Error(`gift checkout ${session.id} has bad metadata`);
        }
        const buyerId = session.customer ? await deps.userForCustomer(idOf(session.customer)!) : null;
        if (!buyerId) console.warn(`stripe-webhook: gift checkout ${session.id} has no LiteraryWorm account`);
        await deps.createGift({
          sessionId: session.id,
          buyerId,
          planId,
          months,
          amountCents: session.amount_total,
          currency: (session.currency ?? "usd").toUpperCase(),
        });
        return;
      }
      if (session.mode !== "subscription" || !session.subscription) return;
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
      const sub = await deps.getSubscription(idOf(session.subscription)!);
      const userId = await deps.userForCustomer(idOf(sub.customer)!);
      if (!userId) {
        console.warn(`stripe-webhook: checkout ${session.id} has no LiteraryWorm account`);
        return;
      }
      if (await deps.isAdmin(userId)) {
        await deps.cancelNow(sub.id);
        return;
      }
      await deps.startMembership(userId, subscriptionRow(sub), new Date(session.created * 1000).toISOString());
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(deps, event.data.object);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (subId) await syncSubscription(deps, await deps.getSubscription(subId));
      return;
    }
    case "invoice.created": {
      const invoice = event.data.object;
      const subId = invoiceSubscriptionId(invoice);
      const userId = invoice.customer ? await deps.userForCustomer(idOf(invoice.customer)!) : null;
      if (subId && userId && (await deps.isAdmin(userId))) {
        await deps.cancelNow(subId);
        if (invoice.status === "draft" && invoice.id) await deps.deleteDraftInvoice(invoice.id);
      }
      return;
    }
    default:
      return; // Disputes, refunds and fraud warnings are recorded for review; nothing else is used.
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing Stripe-Signature.", { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await deps.verify(body, signature);
  } catch {
    return new Response("Bad signature.", { status: 400 });
  }

  try {
    if (await deps.alreadyHandled(event.id)) return Response.json({ received: true, duplicate: true });
    await handleEvent(deps, event);
    // Recorded only once handled, so a failure is retried by Stripe instead of being lost.
    await deps.markHandled(event, REVIEW.has(event.type));
    return Response.json({ received: true });
  } catch (err) {
    console.error(`stripe-webhook: ${event.type} ${event.id} failed`, err);
    return new Response("Failed; Stripe will retry.", { status: 500 });
  }
}
