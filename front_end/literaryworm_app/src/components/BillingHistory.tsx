import { type FormEvent, useEffect, useId, useState } from "react";
import { AccountError, type BillingInvoice, billingHistory, type MembershipDiscount, redeemPromoCode } from "../lib/accountApi";
import { discountLabel, formatMoney, longDate, promoCodeError } from "../lib/billing";
import { Icon } from "./Icon";

const STATUS: Record<BillingInvoice["status"], string> = {
  paid: "Paid",
  open: "Due",
  void: "Not charged",
  uncollectible: "Payment failed",
};

const message = (err: unknown) => (err instanceof AccountError ? err.message : "Something went wrong. Try again.");

/**
 * Account → Plan and billing, for members paying through Stripe: the promo code on the
 * membership (and a box to add one), then every charge with a link to Stripe's receipt.
 */
export function BillingHistory({ canRedeem }: { canRedeem: boolean }) {
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [discount, setDiscount] = useState<MembershipDiscount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bumped by Try again to load once more.
  const [tries, setTries] = useState(0);

  useEffect(() => {
    // Loaded when the section opens; Stripe is the record, so nothing is kept in the store.
    let current = true;
    billingHistory().then(
      (history) => {
        if (!current) return;
        setInvoices(history.invoices);
        setDiscount(history.discount);
      },
      (err) => current && setLoadError(message(err)),
    );
    return () => {
      current = false;
    };
  }, [tries]);

  const retry = () => {
    setLoadError(null);
    setTries((n) => n + 1);
  };

  return (
    <div className="billing-history">
      <PromoCode discount={discount} canRedeem={canRedeem} onApplied={setDiscount} />

      <section aria-labelledby="billing-history-title">
        <h3 id="billing-history-title">Billing history</h3>
        {loadError ? (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <div>
              <p>{loadError}</p>
              <button type="button" className="secondary-button" onClick={retry}>
                Try again
              </button>
            </div>
          </div>
        ) : invoices === null ? (
          <p className="field-hint" role="status">
            Loading your charges…
          </p>
        ) : invoices.length === 0 ? (
          <p className="field-hint">No charges yet.</p>
        ) : (
          <>
            <ul className="invoice-list" role="list">
              {invoices.map((invoice, i) => {
                const date = longDate(new Date(invoice.date));
                return (
                  <li key={`${invoice.date}-${i}`} className="invoice-row">
                    <span className="invoice-date">{date}</span>
                    <span className="invoice-amount">
                      {formatMoney(invoice.amount, invoice.currency)}
                      {invoice.discount > 0 && <small>{formatMoney(invoice.discount, invoice.currency)} off with a promo code</small>}
                    </span>
                    <span className={`status-pill invoice-${invoice.status}`}>{STATUS[invoice.status]}</span>
                    {invoice.url ? (
                      <a className="text-button" href={invoice.url} target="_blank" rel="noreferrer">
                        Receipt<span className="visually-hidden"> for {date} (opens Stripe in a new tab)</span>
                      </a>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
            {invoices.length === 24 && <p className="field-hint">Showing your last 24 charges.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function PromoCode({
  discount,
  canRedeem,
  onApplied,
}: {
  discount: MembershipDiscount | null;
  canRedeem: boolean;
  onApplied: (d: MembershipDiscount) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = promoCodeError(code);
    setDone(null);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const applied = await redeemPromoCode(code.trim());
      onApplied(applied);
      setCode("");
      setDone(`Code applied: ${discountLabel(applied)}.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="promo-code" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Promo code</h3>
      {discount ? (
        <p className="promo-current">
          <Icon name="check" size={17} />
          <span>
            {discount.code && <strong>{discount.code}</strong>} {discountLabel(discount)}
          </span>
        </p>
      ) : (
        <p className="field-hint">No promo code on your membership.</p>
      )}
      {canRedeem && (
        <form className="promo-form" onSubmit={submit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor={id}>
              {discount ? "Use a different code" : "Add a promo code"}
            </label>
            <input
              id={id}
              className="field-input"
              value={code}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
            />
            {error ? (
              <p className="field-error" id={`${id}-error`}>
                <Icon name="alert" size={15} />
                {error}
              </p>
            ) : (
              <p className="field-hint" id={`${id}-hint`}>
                {discount ? "A new code replaces the one you have." : "It applies from your next charge."}
              </p>
            )}
          </div>
          <button type="submit" className="secondary-button" disabled={busy}>
            Apply code
          </button>
        </form>
      )}
      {done && (
        <div className="form-success" role="status">
          <Icon name="check" size={17} />
          <p>{done}</p>
        </div>
      )}
    </section>
  );
}
