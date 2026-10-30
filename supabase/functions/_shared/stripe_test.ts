// deno test --allow-env supabase/functions/_shared/stripe_test.ts — Stripe objects to what members see.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { addGiftMonths, cancellationEnd, discountView, giftCode, invoiceView, oneMonthAfter, oneYearAfter, planForLookupKey, type Stripe, subscriptionRow } from "./stripe.ts";

const invoice = (fields: Partial<Stripe.Invoice>) =>
  ({
    status: "paid",
    created: 1790000000,
    status_transitions: { paid_at: 1790000600 },
    amount_paid: 1039,
    amount_due: 1039,
    currency: "usd",
    total_discount_amounts: [{ amount: 200 }, { amount: 60 }],
    hosted_invoice_url: "https://invoice.stripe.com/i/test_1",
    ...fields,
  }) as unknown as Stripe.Invoice;

Deno.test("an invoice shows when it was paid, what was charged and how much codes took off", () => {
  assertEquals(invoiceView(invoice({})), {
    date: new Date(1790000600 * 1000).toISOString(),
    amount: 1039,
    currency: "usd",
    status: "paid",
    discount: 260,
    url: "https://invoice.stripe.com/i/test_1",
  });
});

Deno.test("an unpaid invoice shows the amount due on the day it was made; drafts are left out", () => {
  const open = invoiceView(invoice({ status: "open", amount_paid: 0, amount_due: 1299, status_transitions: {} as Stripe.Invoice.StatusTransitions, total_discount_amounts: null }));
  assertEquals(open?.amount, 1299);
  assertEquals(open?.discount, 0);
  assertEquals(open?.date, new Date(1790000000 * 1000).toISOString());
  assertEquals(invoiceView(invoice({ status: "draft" })), null);
  assertEquals(invoiceView(invoice({ status: null })), null);
});

Deno.test("a discount shows the code, the coupon's terms and when it ends", () => {
  const discount = {
    end: 1798000000,
    promotion_code: { code: "SPRING20" },
    source: { type: "coupon", coupon: { percent_off: 20, amount_off: null, currency: null, duration: "repeating" } },
  } as unknown as Stripe.Discount;
  assertEquals(discountView([discount]), {
    code: "SPRING20",
    percentOff: 20,
    amountOff: null,
    currency: null,
    duration: "repeating",
    ends: new Date(1798000000 * 1000).toISOString(),
  });
});

Deno.test("no discount, or one not expanded, shows nothing", () => {
  assertEquals(discountView([]), null);
  assertEquals(discountView(["di_1"]), null);
  const unexpanded = { end: null, promotion_code: "promo_1", source: { type: "coupon", coupon: "co_1" } } as unknown as Stripe.Discount;
  assertEquals(discountView([unexpanded]), null);
});

Deno.test("gift months land on a billing day: the 29th to 31st move on to the 1st", () => {
  const day = (iso: string, months: number) => addGiftMonths(new Date(iso), months).toISOString().slice(0, 10);
  assertEquals(day("2026-10-24T12:00:00Z", 3), "2027-01-24");
  assertEquals(day("2026-11-05T00:00:00Z", 12), "2027-11-05");
  assertEquals(day("2026-10-30T09:00:00Z", 1), "2026-12-01");
  assertEquals(day("2027-01-31T00:00:00Z", 1), "2027-03-01");
});

Deno.test("gift codes are 16 easy-to-read characters", () => {
  const codes = new Set(Array.from({ length: 200 }, giftCode));
  assertEquals(codes.size, 200);
  for (const code of codes) assertEquals(/^[A-HJ-NP-Z2-9]{16}$/.test(code), true, code);
});

Deno.test("cancelling 48 hours or more before the billing date ends the membership then", () => {
  const billing = new Date("2026-11-05T09:30:00Z");
  assertEquals(cancellationEnd(billing, new Date("2026-11-01T00:00:00Z")), { ends: billing, late: false });
  // Exactly 48 hours before still counts.
  assertEquals(cancellationEnd(billing, new Date("2026-11-03T09:30:00Z")), { ends: billing, late: false });
});

Deno.test("cancelling with less than 48 hours' notice keeps the next charge and ends a month later", () => {
  const billing = new Date("2026-11-05T09:30:00Z");
  const late = { ends: new Date("2026-12-05T09:30:00Z"), late: true };
  assertEquals(cancellationEnd(billing, new Date("2026-11-03T09:30:01Z")), late);
  assertEquals(cancellationEnd(billing, new Date("2026-11-05T09:00:00Z")), late);
});

Deno.test("a month after keeps the day and time, and ends of months clamp as Stripe renews", () => {
  assertEquals(oneMonthAfter(new Date("2026-12-18T00:00:00Z")).toISOString(), "2027-01-18T00:00:00.000Z");
  assertEquals(oneMonthAfter(new Date("2027-01-31T12:00:00Z")).toISOString(), "2027-02-28T12:00:00.000Z");
  assertEquals(oneMonthAfter(new Date("2028-01-31T12:00:00Z")).toISOString(), "2028-02-29T12:00:00.000Z");
});

Deno.test("a subscription's end date: cancel_at when set, the period end when ending there, else none", () => {
  const base = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    pause_collection: null,
    cancel_at_period_end: false,
    cancel_at: null,
    billing_cycle_anchor: 1_797_552_000,
    items: { data: [{ price: { lookup_key: "literaryworm_standard_monthly" }, current_period_end: 1_798_761_600 }] },
  };
  const row = (o: Record<string, unknown>) => subscriptionRow({ ...base, ...o } as unknown as Stripe.Subscription);
  assertEquals([row({}).cancel_at_period_end, row({}).cancel_at], [false, null]);
  assertEquals([row({ cancel_at_period_end: true }).cancel_at_period_end, row({ cancel_at_period_end: true }).cancel_at], [true, "2027-01-01T00:00:00.000Z"]);
  // A late cancellation: Stripe has cancel_at a period later and cancel_at_period_end off.
  assertEquals([row({ cancel_at: 1_801_440_000 }).cancel_at_period_end, row({ cancel_at: 1_801_440_000 }).cancel_at], [true, "2027-02-01T00:00:00.000Z"]);
});

Deno.test("yearly prices: lookup keys map to plan and interval, a late cancel ends a year on", () => {
  assertEquals(planForLookupKey("literaryworm_premium_yearly"), { plan: "premium", interval: "year" });
  assertEquals(planForLookupKey("literaryworm_basic_monthly"), { plan: "basic", interval: "month" });
  assertEquals(planForLookupKey("something_else"), null);
  assertEquals(oneYearAfter(new Date("2028-02-29T10:00:00Z")).toISOString(), "2029-02-28T10:00:00.000Z");
  const billing = new Date("2027-03-10T00:00:00Z");
  assertEquals(cancellationEnd(billing, new Date("2027-03-09T00:00:00Z"), "year"), { ends: new Date("2028-03-10T00:00:00Z"), late: true });
  assertEquals(cancellationEnd(billing, new Date("2027-03-01T00:00:00Z"), "year"), { ends: billing, late: false });
});

Deno.test("a yearly subscription's row says so, and a 31st start keeps its billing day within 1–28", () => {
  const sub = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    pause_collection: null,
    cancel_at_period_end: false,
    cancel_at: null,
    billing_cycle_anchor: Date.UTC(2026, 9, 31) / 1000,
    items: { data: [{ price: { lookup_key: "literaryworm_standard_yearly" }, current_period_end: Date.UTC(2027, 9, 31) / 1000 }] },
  } as unknown as Stripe.Subscription;
  const row = subscriptionRow(sub);
  assertEquals([row.plan_id, row.billing_interval, row.billing_day], ["standard", "year", 28]);
});

Deno.test("a yearly subscription waiting to move to monthly says so only while its schedule is attached", () => {
  const sub = (o: Record<string, unknown>) =>
    subscriptionRow({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      pause_collection: null,
      cancel_at_period_end: false,
      cancel_at: null,
      billing_cycle_anchor: Date.UTC(2026, 9, 10) / 1000,
      items: { data: [{ price: { lookup_key: "literaryworm_standard_yearly" }, current_period_end: Date.UTC(2027, 9, 10) / 1000 }] },
      metadata: {},
      schedule: null,
      ...o,
    } as unknown as Stripe.Subscription).switch_to_monthly;
  assertEquals(sub({}), null);
  assertEquals(sub({ schedule: "sub_sched_1", metadata: { switch_to_monthly: "basic" } }), "basic");
  // Released early (Keep yearly): the key may linger, the schedule doesn't.
  assertEquals(sub({ schedule: null, metadata: { switch_to_monthly: "basic" } }), null);
  assertEquals(sub({ schedule: "sub_sched_1", metadata: { switch_to_monthly: "gold" } }), null);
});
