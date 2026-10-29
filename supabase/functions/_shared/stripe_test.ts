// deno test --allow-env supabase/functions/_shared/stripe_test.ts — Stripe objects to what members see.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { discountView, invoiceView, type Stripe } from "./stripe.ts";

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
