// POST /functions/v1/stripe-webhook — Stripe's events, the only way a paid membership is written.
//
// Every event's signature is checked first (STRIPE_WEBHOOK_SECRET). Events are mapped to an
// account through the Stripe Customer (stripe_customers), never through metadata, and each is
// handled once (stripe_events). Staff are never billed (any staff role gives a complimentary
// membership): a subscription that reaches a staff member's customer is cancelled at once, and a
// renewal invoice drafted for one is deleted before it's paid.
//
// More natural-voice hours: a paid Checkout with metadata.kind "voice_hours" adds a pack
// (add_natural_voice_pack(), once per session) to the buyer's account.
//
// Gifts: a paid gift Checkout (mode payment, metadata.kind "gift") makes a gift code for the buyer,
// once per Checkout Session. A redeemed gift that starts a membership is a Stripe subscription
// carrying metadata.gift_consent_at (the redeemer agreed to the terms for after the gift in
// Account); its first event creates the membership with that consent.
//
// Handled: checkout.session.completed and .async_payment_succeeded (start the membership, or a gift),
// customer.subscription.created/.updated/.deleted and invoice.paid/.payment_failed (keep it in
// step; a first failed attempt also emails the member, email.ts), invoice.created (staff), and charge.dispute.created, charge.refunded and
// radar.early_fraud_warning.created (kept for the team to review; a referral reward is taken back for the
// first two), charge.dispute.closed (a won dispute gives it again). Everything else is ignored.
//
// Refer a friend: an invited member's first paid invoice credits 20% of one month of each member's
// own plan to them and to whoever invited them, the inviter once per account (claim_referral_reward()
// decides, once; see rewardReferral()). Referrals earned before 2026-11-23 keep the free month. A full
// refund (charge.refunded) or a dispute (charge.dispute.created) of that first payment takes both 20%
// credits back; a dispute closed in our favour (charge.dispute.closed, won) adds them again.
//
// Affiliates: a member who signed up with an approved affiliate's code earns that affiliate 20% of
// their first payment as a balance credit (claim_affiliate_commission() decides, once; see
// rewardAffiliate()). Credits only, never payouts.

import { CATALOG } from "../_shared/catalog.ts";
import { CHARACTERS_PER_HOUR } from "../_shared/naturalVoice.ts";
import type { Stripe } from "../_shared/stripe.ts";
import { isVoicePack, GIFT_CARD_CENTS, type GiftCardCents, GIFT_MONTHS, type GiftMonths, giftBooksFromMetadata, parseGiftBooks, parseGiftMessage, parseGiftRecipient, type PlanId, PLANS, subscriptionRow } from "../_shared/stripe.ts";

export type SubscriptionFields = ReturnType<typeof subscriptionRow>;

export interface Deps {
  verify: (body: string, signature: string) => Promise<Stripe.Event>;
  alreadyHandled: (eventId: string) => Promise<boolean>;
  markHandled: (event: Stripe.Event, needsReview: boolean) => Promise<void>;
  userForCustomer: (customerId: string) => Promise<string | null>;
  /** Whether the account holds any staff role. */
  isStaff: (userId: string) => Promise<boolean>;
  /** Notes the account's first real payment (record_card_payment()), which verifies a parent's Kids consent. */
  recordCardPayment: (userId: string) => Promise<void>;
  getSubscription: (id: string) => Promise<Stripe.Subscription>;
  /** Creates or replaces the membership; consentAt records when auto-renewal was agreed. */
  startMembership: (userId: string, fields: SubscriptionFields, consentAt: string) => Promise<void>;
  /** Updates an existing membership; false when the account has none yet. */
  updateMembership: (userId: string, fields: SubscriptionFields) => Promise<boolean>;
  cancelNow: (subscriptionId: string) => Promise<void>;
  /** Makes the gift code for a paid gift Checkout; does nothing if it already exists. */
  createGift: (gift: NewGift) => Promise<void>;
  deleteDraftInvoice: (invoiceId: string) => Promise<void>;
  /**
   * Refer a friend: decides the invited member's reward once (on the payment of `invoiceId`) and gives
   * the Stripe transactions it still needs. `legacy` is the old database function's answer (before
   * migration 6843), handled the old way.
   */
  claimReferral: (referredId: string, invoiceId: string | null) => Promise<ReferralClaim>;
  /** Takes a 20% reward back when the invoice that earned it is fully refunded or disputed: the reversals still needed. */
  reverseReferral: (referredId: string, invoiceId: string) => Promise<ReferralTransaction[]>;
  /** Gives a 20% reward again when a dispute of that invoice is closed in our favour: the credits still needed. */
  restoreReferral: (referredId: string, invoiceId: string) => Promise<ReferralTransaction[]>;
  /** A balance transaction already made with this key (kept in its metadata), so an expired idempotency key can't make it twice. */
  findBalanceTransaction: (customerId: string, key: string) => Promise<string | null>;
  /** Adds to a Stripe customer's balance: negative is a credit, positive is owed on the next invoice; returns its id. */
  adjustBalance: (customerId: string, amountCents: number, currency: string, key: string, description: string) => Promise<string>;
  /** Records one referral transaction the moment it's made (record_referral_transaction()). */
  recordReferralTransaction: (txn: ReferralTransaction, transactionId: string) => Promise<void>;
  /** A charge's customer, whether it's fully refunded, and the invoice it paid (null for a payment that isn't an invoice's). */
  chargeDetails: (chargeId: string) => Promise<{ customer: string | null; refunded: boolean; invoiceId: string | null }>;
  /** Adds a USD credit to a Stripe customer's balance (taken off their next invoices); returns its id. */
  creditCustomer: (customerId: string, cents: number, idempotencyKey: string, description: string) => Promise<string>;
  /** The old database's (before 6843) way to record both credits, and to hand a failed claim back. */
  recordReferralCredits: (referralId: string, friendCredit: string, referrerCredit: string | null) => Promise<void>;
  releaseReferral: (referralId: string) => Promise<void>;
  /** Affiliates: claims the referred member's commission once (null when there's nothing to give). */
  claimAffiliate: (referredId: string, amountCents: number) => Promise<AffiliateCommission | null>;
  recordAffiliateCredit: (referralId: string, creditId: string) => Promise<void>;
  releaseAffiliate: (referralId: string) => Promise<void>;
  /** Emails the member that a payment failed (a failure is only logged). */
  notifyPaymentFailed: (userId: string) => Promise<void>;
  /** Adds a paid pack of natural-voice hours, once per Checkout Session. */
  addVoicePack: (pack: { sessionId: string; userId: string; hours: number; characters: number; amountCents: number }) => Promise<void>;
}

/** What claim_affiliate_commission() gives: 20% of the referred member's first payment, in cents. */
export interface AffiliateCommission {
  referralId: string;
  affiliateCustomer: string;
  cents: number;
}

/** Which offer a referral follows (referrals.reward_rule, migration 6843). */
export type ReferralRule = "free_month" | "percent_20";

/** What the old claim_referral_reward() gave (before migration 6843): a free month for each side, in USD. */
export interface ReferralReward {
  referralId: string;
  friendCustomer: string;
  friendCents: number;
  /** Null when the inviter gets nothing for this one (staff, no membership, or 2 months already earned). */
  referrerCustomer: string | null;
  referrerCents: number | null;
}

/** One Stripe balance transaction a referral still needs (private.referral_pending()). */
export interface ReferralTransaction {
  referralId: string;
  side: "friend" | "referrer";
  /** credit: the reward; reversal: taking it back (round n); recredit: the reward again after a won dispute (round n). */
  kind: "credit" | "reversal" | "recredit";
  round: number;
  customer: string;
  /** Always positive; the sign comes from the kind. */
  cents: number;
  /** The side's own plan currency, lower case. */
  currency: string;
  rule: ReferralRule;
}

export interface ReferralClaim {
  pending: ReferralTransaction[];
  legacy?: ReferralReward | null;
}

/** The Stripe idempotency key (also kept in the transaction's metadata) for one referral transaction. */
export function referralKey(txn: Pick<ReferralTransaction, "referralId" | "side" | "kind" | "round" | "rule">): string {
  if (txn.rule === "free_month") return `referral-${txn.referralId}-${txn.side}`;
  if (txn.kind === "credit") return `referral20-${txn.referralId}-${txn.side}`;
  return `referral20-${txn.referralId}-${txn.side}-${txn.kind}-${txn.round}`;
}

/** What members see on their balance for each transaction. */
export function referralDescription(txn: Pick<ReferralTransaction, "side" | "kind" | "rule">): string {
  if (txn.rule === "free_month") {
    return txn.side === "friend" ? "A month free: you joined with a friend's invitation" : "A month free: a friend you invited joined";
  }
  if (txn.kind === "reversal") return "20% referral credit taken back: the first payment was refunded or disputed";
  if (txn.kind === "recredit") return "20% referral credit added again: the dispute was closed in our favour";
  return txn.side === "friend" ? "20% off one month: you joined with a friend's invitation" : "20% off one month: a friend you invited joined";
}

/** How many times a recording is tried after its Stripe transaction went through. */
const RECORD_TRIES = 3;

export interface NewGift {
  sessionId: string;
  buyerId: string | null;
  /** A gift membership's plan and months; null for a gift card. */
  planId: PlanId | null;
  months: GiftMonths | null;
  /** A gift card's credit in cents; null for a gift membership. */
  creditCents: GiftCardCents | null;
  /** A gift of natural-voice hours (5 or 10); null for the other gifts. */
  voiceHours?: number | null;
  amountCents: number;
  currency: string;
  /** The first day the code can be redeemed ("YYYY-MM-DD"), when the buyer picked one. */
  startsOn: string | null;
  /** Who gift-reminders emails the code to, and the buyer's message; null when the buyer passes it on. */
  recipientEmail: string | null;
  message: string | null;
  /** LiteraryWorm books that come with it (catalog ids), added to the redeemer's library. */
  books: string[];
}

/** The books from a gift Checkout's metadata, checked again; dropped (and logged) if they don't pass. */
function giftBooks(metadata: Record<string, string>, sessionId: string): string[] {
  try {
    return parseGiftBooks(giftBooksFromMetadata(metadata.books), (id) => id in CATALOG);
  } catch (err) {
    // The buyer has paid: make the code anyway, without the books.
    console.warn(`stripe-webhook: gift checkout ${sessionId} has books that don't pass: ${(err as Error).message}`);
    return [];
  }
}

/** The recipient and message from a gift Checkout's metadata, checked again; dropped (and logged) if they don't pass. */
function giftRecipient(metadata: Record<string, string>, sessionId: string): { recipientEmail: string | null; message: string | null } {
  try {
    const recipientEmail = parseGiftRecipient(metadata.recipient_email);
    return { recipientEmail, message: recipientEmail ? parseGiftMessage(metadata.message) : null };
  } catch (err) {
    // The buyer has paid: make the code anyway, for them to pass on.
    console.warn(`stripe-webhook: gift checkout ${sessionId} has a recipient that doesn't pass: ${(err as Error).message}`);
    return { recipientEmail: null, message: null };
  }
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
  if (await deps.isStaff(userId)) {
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

/**
 * Makes each referral transaction still needed, one side at a time: first looks for one already made
 * with its key (Stripe's idempotency keys expire after a day), then records it at once, retrying the
 * record. A side that fails doesn't stop the other; any failure is thrown at the end so Stripe retries the
 * event, and the retry only makes what's still missing.
 */
async function settleReferral(deps: Deps, pending: ReferralTransaction[]): Promise<void> {
  const failures: unknown[] = [];
  for (const txn of pending) {
    try {
      const key = referralKey(txn);
      const id =
        (await deps.findBalanceTransaction(txn.customer, key)) ??
        (await deps.adjustBalance(txn.customer, txn.kind === "reversal" ? txn.cents : -txn.cents, txn.currency, key, referralDescription(txn)));
      let recorded: unknown = null;
      for (let attempt = 0; attempt < RECORD_TRIES; attempt++) {
        try {
          await deps.recordReferralTransaction(txn, id);
          recorded = null;
          break;
        } catch (err) {
          recorded = err;
        }
      }
      if (recorded) throw recorded;
    } catch (err) {
      failures.push(err);
    }
  }
  if (failures.length) throw failures[0];
}

/**
 * Refer a friend: when an invited member's payment goes through, the database decides the reward once
 * (on the first payment, remembering its invoice) and says what's still to make: 20% of one month of
 * each member's own plan, the inviter once per account. A later payment or a retry only completes what's
 * missing. With the old database function (before 6843) it works the old way: both, then hand back.
 */
async function rewardReferral(deps: Deps, customerId: string | null, amountPaid: number, invoiceId: string | null): Promise<void> {
  if (!customerId || amountPaid <= 0) return;
  const userId = await deps.userForCustomer(customerId);
  if (!userId || (await deps.isStaff(userId))) return;
  const claim = await deps.claimReferral(userId, invoiceId);
  if (claim.legacy) return legacyReward(deps, claim.legacy);
  await settleReferral(deps, claim.pending);
}

async function legacyReward(deps: Deps, reward: ReferralReward): Promise<void> {
  try {
    const friend = await deps.creditCustomer(reward.friendCustomer, reward.friendCents, `referral-${reward.referralId}-friend`, "A month free: you joined with a friend's invitation");
    let referrer: string | null = null;
    if (reward.referrerCustomer && reward.referrerCents) {
      referrer = await deps.creditCustomer(reward.referrerCustomer, reward.referrerCents, `referral-${reward.referralId}-referrer`, "A month free: a friend you invited joined");
    }
    await deps.recordReferralCredits(reward.referralId, friend, referrer);
  } catch (err) {
    await deps.releaseReferral(reward.referralId);
    throw err;
  }
}

/**
 * Refunds and disputes: when the friend's first payment is fully refunded, or disputed, both 20% credits
 * are taken back with a positive balance (owed on the next bill if the credit was already used). A
 * partial refund takes nothing back. When a dispute is closed in our favour (won, or an inquiry closed)
 * and the charge isn't refunded, the credits are added again. Free months are never taken back.
 */
async function takeBackReferral(deps: Deps, chargeId: string | null, restore: boolean): Promise<void> {
  if (!chargeId) return;
  const charge = await deps.chargeDetails(chargeId);
  if (!charge.customer || !charge.invoiceId) return;
  const userId = await deps.userForCustomer(charge.customer);
  if (!userId) return;
  if (restore) {
    if (charge.refunded) return;
    await settleReferral(deps, await deps.restoreReferral(userId, charge.invoiceId));
  } else {
    await settleReferral(deps, await deps.reverseReferral(userId, charge.invoiceId));
  }
}

/**
 * Affiliates: when a member who signed up with an affiliate's code makes their first payment, 20% of
 * it is credited to the affiliate's own Stripe balance (the database decides, once). An idempotency
 * key per referral keeps a retried event from crediting twice; a failure hands the claim back.
 */
async function rewardAffiliate(deps: Deps, customerId: string | null, amountPaid: number): Promise<void> {
  if (!customerId || amountPaid <= 0) return;
  const userId = await deps.userForCustomer(customerId);
  if (!userId) return;
  const commission = await deps.claimAffiliate(userId, amountPaid);
  if (!commission) return;
  try {
    const credit = await deps.creditCustomer(
      commission.affiliateCustomer,
      commission.cents,
      `affiliate-${commission.referralId}`,
      "Affiliate commission: 20% of a referred member's first payment",
    );
    await deps.recordAffiliateCredit(commission.referralId, credit);
  } catch (err) {
    await deps.releaseAffiliate(commission.referralId);
    throw err;
  }
}

/**
 * COPPA: a parent's consent to a Kids profile is verified by a card payment on the account. Any real
 * payment counts (a membership invoice above $0, or a paid Checkout: membership, natural-voice hours,
 * a gift or a gift card); a free week or an invoice paid by a credit doesn't. Kept once, the first time.
 */
async function noteCardPayment(deps: Deps, customer: string | { id: string } | null | undefined, amountPaid: number | null | undefined): Promise<void> {
  const customerId = idOf(customer);
  if (!customerId || !amountPaid || amountPaid <= 0) return;
  const userId = await deps.userForCustomer(customerId);
  if (userId) await deps.recordCardPayment(userId);
}

async function handleEvent(deps: Deps, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status === "paid") await noteCardPayment(deps, session.customer, session.amount_total);
      if (session.mode === "payment" && session.metadata?.kind === "voice_hours") {
        if (session.payment_status !== "paid") return;
        const hours = Number(session.metadata.hours);
        if (!isVoicePack(hours) || !session.customer || session.amount_total === null || session.amount_total === undefined) {
          throw new Error(`voice hours checkout ${session.id} has bad metadata`);
        }
        const userId = await deps.userForCustomer(idOf(session.customer)!);
        if (!userId) {
          // Kept for the team to sort out by hand; nothing to add it to.
          console.warn(`stripe-webhook: voice hours checkout ${session.id} has no LiteraryWorm account`);
          return;
        }
        await deps.addVoicePack({ sessionId: session.id, userId, hours, characters: hours * CHARACTERS_PER_HOUR, amountCents: session.amount_total });
        return;
      }
      if (session.mode === "payment" && session.metadata?.kind === "gift") {
        if (session.payment_status !== "paid") return;
        const voices = session.metadata.gift_kind === "voice_hours";
        const card = session.metadata.gift_kind === "credit";
        const planId = card || voices ? null : (session.metadata.plan_id as PlanId);
        const months = card || voices ? null : (Number(session.metadata.months) as GiftMonths);
        const creditCents = card ? (Number(session.metadata.credit_cents) as GiftCardCents) : null;
        const voiceHours = voices ? Number(session.metadata.voice_hours) : null;
        const startsOn = session.metadata.starts_on ?? null;
        const shapeOk = voices
          ? isVoicePack(voiceHours)
          : card
            ? GIFT_CARD_CENTS.includes(creditCents!)
            : PLANS.includes(planId!) && GIFT_MONTHS.includes(months!);
        if (!shapeOk || !session.amount_total || (startsOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn))) {
          throw new Error(`gift checkout ${session.id} has bad metadata`);
        }
        const buyerId = session.customer ? await deps.userForCustomer(idOf(session.customer)!) : null;
        if (!buyerId) console.warn(`stripe-webhook: gift checkout ${session.id} has no LiteraryWorm account`);
        await deps.createGift({
          sessionId: session.id,
          buyerId,
          planId,
          months,
          creditCents,
          voiceHours,
          amountCents: session.amount_total,
          currency: (session.currency ?? "usd").toUpperCase(),
          startsOn,
          ...giftRecipient(session.metadata, session.id),
          // A gift card comes without books.
          books: card || voices ? [] : giftBooks(session.metadata, session.id),
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
      if (await deps.isStaff(userId)) {
        await deps.cancelNow(sub.id);
        return;
      }
      await deps.startMembership(userId, subscriptionRow(sub), new Date(session.created * 1000).toISOString());
      // The first payment may have come in before the membership was written: reward it now.
      if (session.payment_status === "paid") {
        await rewardReferral(deps, idOf(sub.customer), session.amount_total ?? 0, idOf(session.invoice));
        await rewardAffiliate(deps, idOf(sub.customer), session.amount_total ?? 0);
      }
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
      // A failed membership payment: the member hears once, on Stripe's first attempt (never staff).
      if (event.type === "invoice.payment_failed" && subId && (event.data.object.attempt_count ?? 1) <= 1 && event.data.object.customer) {
        const userId = await deps.userForCustomer(idOf(event.data.object.customer)!);
        if (userId && !(await deps.isStaff(userId))) {
          await deps.notifyPaymentFailed(userId).catch((err: unknown) => console.error("stripe-webhook: couldn't email a failed payment", err));
        }
      }
      if (event.type === "invoice.paid") await noteCardPayment(deps, event.data.object.customer, event.data.object.amount_paid);
      if (event.type === "invoice.paid" && subId) {
        await rewardReferral(deps, idOf(event.data.object.customer), event.data.object.amount_paid ?? 0, event.data.object.id ?? null);
        await rewardAffiliate(deps, idOf(event.data.object.customer), event.data.object.amount_paid ?? 0);
      }
      return;
    }
    case "invoice.created": {
      const invoice = event.data.object;
      const subId = invoiceSubscriptionId(invoice);
      const userId = invoice.customer ? await deps.userForCustomer(idOf(invoice.customer)!) : null;
      if (subId && userId && (await deps.isStaff(userId))) {
        await deps.cancelNow(subId);
        if (invoice.status === "draft" && invoice.id) await deps.deleteDraftInvoice(invoice.id);
      }
      return;
    }
    case "charge.refunded":
      // Only a full refund takes a referral reward back.
      if (event.data.object.refunded) await takeBackReferral(deps, event.data.object.id, false);
      return;
    case "charge.dispute.created":
      return takeBackReferral(deps, idOf(event.data.object.charge), false);
    case "charge.dispute.closed": {
      const status = event.data.object.status;
      if (status === "won" || status === "warning_closed") await takeBackReferral(deps, idOf(event.data.object.charge), true);
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
