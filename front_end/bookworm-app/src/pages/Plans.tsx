import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { formatPrice, planById, planFaqs, plans } from "../data/plans";
import { AccountError, choosePlan } from "../lib/accountApi";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";
import type { Plan, PlanId } from "../types";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function nextBillingDate(day: number, from = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth(), day);
  if (next <= from) next.setMonth(next.getMonth() + 1);
  return next;
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function Plans() {
  useTitle("Plans and pricing");
  const { state, dispatch } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = params.get("setup") === "1";
  const account = state.account;
  const initialPlan = (params.get("plan") as PlanId | null) ?? null;

  const [selected, setSelected] = useState<PlanId | null>(
    account && initialPlan && planById.has(initialPlan) && initialPlan !== account.planId ? initialPlan : null,
  );
  const [billingDay, setBillingDay] = useState(() => Math.min(new Date().getDate(), 28));
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [confirmed, setConfirmed] = useState<PlanId | null>(null);
  const checkoutRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (selected) checkoutRef.current?.focus();
  }, [selected]);

  const choose = (plan: Plan) => {
    if (!account) {
      navigate(`/signup?plan=${plan.id}`);
      return;
    }
    setSelected(plan.id);
    setAgreed(false);
    setAgreeError(false);
    setConfirmed(null);
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!agreed) {
      setAgreeError(true);
      return;
    }
    if (account?.userId) {
      // Real accounts: the checkout Edge Function writes the subscription (never the browser).
      setSaving(true);
      setSaveError(null);
      try {
        await choosePlan(selected, billingDay);
      } catch (err) {
        setSaveError(err instanceof AccountError ? err.message : "We couldn't save your plan. Try again.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    dispatch({ type: "choosePlan", planId: selected, billingDay });
    setConfirmed(selected);
    setSelected(null);
    if (setup) navigate("/profiles?setup=1");
  };

  const plan = selected ? planById.get(selected)! : null;
  const isDemo = Boolean(account?.isDemo);

  return (
    <div className="plans-page">
      <header className="plans-intro">
        {setup && account && !account.planId ? (
          <>
            <p className="eyebrow">Step 2 of 3</p>
            <h1>Choose your plan, {account.name.split(" ")[0]}</h1>
            <p>Every plan includes the full ebook catalog. Pick how much listening and how many profiles you need.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">Plans and pricing</p>
            <h1>One membership for every reader at home</h1>
            <p>Ebooks and audiobooks in one place. Prices are per month, in US dollars. Cancel online any time.</p>
          </>
        )}
      </header>

      {confirmed && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            You're on <strong>{planById.get(confirmed)!.name}</strong>. We've emailed a confirmation with your price,
            renewal date and how to cancel.
          </p>
        </div>
      )}

      <ul className="plan-grid">
        {plans.map((p) => {
          const current = account?.planId === p.id;
          const isSelected = selected === p.id;
          return (
            <li key={p.id} className={`plan-card${isSelected ? " is-selected" : ""}${current ? " is-current" : ""}`}>
              <h2>{p.name}</h2>
              <p className="plan-summary">{p.summary}</p>
              <p className="plan-price">
                <strong>{formatPrice(p.price)}</strong>
                <span>/month</span>
              </p>
              <ul className="plan-features">
                <li>
                  <Icon name="users" size={17} />
                  {p.profiles === 1 ? "1 profile" : `Up to ${p.profiles} profiles`}
                </li>
                <li>
                  <Icon name="headphones" size={17} />
                  {p.audioHours}
                </li>
                <li>
                  <Icon name="download" size={17} />
                  {p.downloads}
                </li>
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={17} />
                    {f}
                  </li>
                ))}
              </ul>
              {current ? (
                <p className="plan-current">
                  <Icon name="check" size={16} /> Your current plan
                </p>
              ) : (
                <button
                  type="button"
                  className={isSelected ? "primary-button is-on" : "primary-button"}
                  aria-pressed={account ? isSelected : undefined}
                  onClick={() => choose(p)}
                >
                  {account?.planId ? `Switch to ${p.name}` : `Choose ${p.name}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {plan && account && (
        <section className="checkout" aria-labelledby="checkout-title">
          <h2 id="checkout-title" ref={checkoutRef} tabIndex={-1}>
            Confirm {plan.name}
          </h2>
          {isDemo ? (
            <div className="form-alert">
              <Icon name="alert" size={17} />
              <p>
                The demo account can't make payments. <Link to="/signup">Create an account</Link> to choose a plan.
              </p>
            </div>
          ) : (
            <form className="checkout-grid" noValidate onSubmit={confirm}>
              <dl className="checkout-summary">
                <div>
                  <dt>Plan</dt>
                  <dd>{plan.name}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{formatPrice(plan.price)} a month, plus any applicable tax</dd>
                </div>
                <div>
                  <dt>First charge</dt>
                  <dd>Today</dd>
                </div>
                <div>
                  <dt>Next charge</dt>
                  <dd>{longDate(nextBillingDate(billingDay))}</dd>
                </div>
              </dl>

              <div className="checkout-fields">
                <div className="field">
                  <label className="field-label" htmlFor="billing-day">
                    Billing day
                  </label>
                  <select
                    id="billing-day"
                    className="field-input"
                    value={billingDay}
                    onChange={(e) => setBillingDay(Number(e.target.value))}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        The {ordinal(d)} of each month
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">You can change this later in Account.</p>
                </div>

                <div className="card-note">
                  <Icon name="lock" size={17} />
                  <p>
                    Card details go straight to our payment provider, Stripe, and never reach BookWorm. In this demo, no card
                    is asked for or charged.
                  </p>
                </div>

                <p className="renewal-terms">
                  Your membership renews automatically every month on the {ordinal(billingDay)} at{" "}
                  {formatPrice(plan.price)} until you cancel. Cancel online any time from Account; you'll keep access
                  until the end of the period you've paid for.
                </p>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (e.target.checked) setAgreeError(false);
                    }}
                    aria-invalid={agreeError || undefined}
                    aria-describedby={agreeError ? "agree-error" : undefined}
                  />
                  <span>I understand my membership renews automatically until I cancel.</span>
                </label>
                {agreeError && (
                  <p className="field-error" id="agree-error">
                    <Icon name="alert" size={15} />
                    Confirm you understand the renewal terms to continue.
                  </p>
                )}

                {saveError && (
                  <div className="form-alert" role="alert">
                    <Icon name="alert" size={17} />
                    <p>{saveError}</p>
                  </div>
                )}
                <div className="checkout-actions">
                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? "Saving your plan…" : `Start ${plan.name} for ${formatPrice(plan.price)}/month`}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions about plans</h2>
        <div className="faq-list">
          {planFaqs.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Icon name="chevronDown" size={18} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
