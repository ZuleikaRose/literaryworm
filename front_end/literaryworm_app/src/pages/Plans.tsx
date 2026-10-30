import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { RedeemGift } from "../components/RedeemGift";
import { WhatsNewLink } from "../components/WhatsNewLink";
import { formatPrice, perPeriod, planById, planFaqs, plans, priceFor } from "../data/plans";
import { AccountError, choosePlan, listOfflineDevices, loadAccount, planFields } from "../lib/accountApi";
import { CANCEL_NOTICE_HOURS, endDate, longDate, nextBillingDate, oneYearAfter, ordinal } from "../lib/billing";
import { profilesInUse, tooBigFor } from "../lib/planLimits";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";
import type { BillingInterval, Plan, PlanId } from "../types";

export default function Plans() {
  useTitle("Plans and pricing");
  const { state, dispatch } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = params.get("setup") === "1";
  const account = state.account;
  // Staff accounts (any staff role) are complimentary and never charged: they have no plan to choose.
  const complimentary = Boolean(account?.complimentary);
  const initialPlan = (params.get("plan") as PlanId | null) ?? null;
  // Monthly or yearly: ?billing=yearly or ?billing=monthly picks one, else the member's own billing.
  const [interval, setBillingInterval] = useState<BillingInterval>(() =>
    params.get("billing") === "yearly" ? "year" : params.get("billing") === "monthly" ? "month" : (account?.billingInterval ?? "month"),
  );
  const yearlyNow = Boolean(account?.planId && account.billingInterval === "year");

  const [selected, setSelected] = useState<PlanId | null>(
    account && !complimentary && initialPlan && planById.has(initialPlan) && initialPlan !== account.planId ? initialPlan : null,
  );
  const [startsOn] = useState(() => new Date());
  const today = startsOn.getDate();
  const [billingDay, setBillingDay] = useState(() => Math.min(today, 28));
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [confirmed, setConfirmed] = useState<PlanId | null>(null);
  // A yearly member who chose monthly billing from their renewal date, just now.
  const [switched, setSwitched] = useState<PlanId | null>(null);
  const checkoutRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (selected) checkoutRef.current?.focus();
  }, [selected]);

  // A smaller plan needs the household to fit it: members' offline places are counted on the server.
  const [offlineDevices, setOfflineDevices] = useState(0);
  const userId = account?.userId;
  useEffect(() => {
    if (!selected || !userId) return;
    let stale = false;
    listOfflineDevices()
      .then((devices) => {
        if (!stale) setOfflineDevices(devices.length);
      })
      .catch(() => {
        // The checkout function checks again, so carry on without the count.
      });
    return () => {
      stale = true;
    };
  }, [selected, userId]);

  // Back from Stripe Checkout: Stripe tells the stripe-webhook function, which writes the membership
  // a moment later, so look for it every couple of seconds, then carry on.
  const checkoutResult = params.get("checkout");
  const [waiting, setWaiting] = useState<"waiting" | "slow" | null>(checkoutResult === "success" ? "waiting" : null);
  useEffect(() => {
    if (checkoutResult !== "success" || !account?.userId) return;
    let tries = 0;
    let stopped = false;
    const look = async () => {
      if (stopped) return;
      tries += 1;
      try {
        const fresh = await loadAccount();
        if (fresh?.planId && fresh.stripeLinked) {
          dispatch({ type: "updateAccount", patch: planFields(fresh) });
          navigate(setup ? "/profiles?setup=1" : "/account#plan", { replace: true });
          return;
        }
      } catch {
        // Offline for a moment: keep looking.
      }
      if (tries >= 15) setWaiting("slow");
      else window.setTimeout(look, 2000);
    };
    void look();
    return () => {
      stopped = true;
    };
    // Runs once on the way back from Stripe.
  }, [checkoutResult, account?.userId, setup, dispatch, navigate]);

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
      // Real accounts: a new membership is paid on Stripe's Checkout page, and Stripe tells the
      // stripe-webhook function, which writes it (never the browser). A plan change is made in place.
      setSaving(true);
      setSaveError(null);
      try {
        const { url } = await choosePlan(selected, billingDay, setup && !account.planId, interval);
        if (url) {
          window.location.assign(url);
          return;
        }
      } catch (err) {
        setSaveError(err instanceof AccountError ? err.message : "We couldn't start your plan. Try again.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    // Yearly to monthly waits for the renewal date: nothing about the plan changes today.
    if (toMonthlyFromYearly) {
      dispatch({ type: "updateAccount", patch: { switchToMonthly: selected } });
      setSwitched(selected);
      setSelected(null);
      return;
    }
    dispatch({ type: "choosePlan", planId: selected, billingDay, billingInterval: interval });
    setConfirmed(selected);
    setSelected(null);
    if (setup) navigate("/profiles?setup=1");
  };

  const plan = selected ? planById.get(selected)! : null;
  const tooBig = plan ? tooBigFor(plan, { profiles: profilesInUse(state.profiles).length, offlineDevices }) : [];
  const isDemo = Boolean(account?.isDemo);
  // A member already paying through Stripe switches plan from their next billing date.
  const changingPaid = Boolean(account?.userId && account.stripeLinked && account.status !== "cancelled");
  const billsToday = billingDay === today;
  const yearly = interval === "year";
  const price = plan ? priceFor(plan, interval) : 0;
  const per = perPeriod(interval);
  // Moving a paid membership: monthly to yearly starts the year today; a yearly one moves up today
  // (paying the difference for the rest of the year) or down at renewal, and to monthly at renewal.
  const fromYearly = changingPaid && yearlyNow;
  const toMonthlyFromYearly = fromYearly && !yearly;
  const renewalDate = account?.renewsAt ? endDate(account.renewsAt) : "your renewal date";
  const renewalDay = account?.renewsAt ? Math.min(new Date(account.renewsAt).getUTCDate(), 28) : billingDay;
  const yearlyUpgrade = Boolean(fromYearly && yearly && plan && account?.planId && plan.price > planById.get(account.planId)!.price);
  const changeWhen = !changingPaid
    ? null
    : toMonthlyFromYearly
      ? `On ${renewalDate}, when your year would renew. Nothing is charged or refunded today; your year carries on as it is.`
      : yearly && !fromYearly
      ? "Today. Your year starts now, and the unused part of this month comes off the first yearly charge."
      : yearlyUpgrade
        ? "Today. You pay the difference for the rest of your year now, and the new price from your renewal date."
        : fromYearly
          ? "From your renewal date. Nothing is charged today."
          : "From your next billing date. Nothing is charged today.";

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
            <p>Ebooks and audiobooks in one place. Prices are in US dollars. Pay monthly, or yearly with two months free. Cancel online any time.</p>
          </>
        )}
      </header>

      {waiting && (
        <div className={waiting === "slow" ? "form-alert" : "form-success"} role="status">
          <Icon name={waiting === "slow" ? "alert" : "check"} size={18} />
          <p>
            {waiting === "slow"
              ? "Your payment went through, but your membership is taking longer than usual to appear. Refresh this page in a minute, or email support@literaryworm.com if it doesn't."
              : "Payment received. Setting up your membership…"}
          </p>
        </div>
      )}

      {checkoutResult === "cancelled" && (
        <div className="form-alert" role="status">
          <Icon name="alert" size={18} />
          <p>You left the payment page, so nothing was charged. Choose a plan when you're ready.</p>
        </div>
      )}

      {complimentary && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            Your staff account has a complimentary <strong>Premium</strong> membership. It's never charged, so
            there's no plan to choose.
          </p>
        </div>
      )}

      {switched && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            Done. Your year carries on as it is, then you'll pay <strong>{formatPrice(planById.get(switched)!.price)} a month</strong> for{" "}
            {planById.get(switched)!.name} from {renewalDate}. Changed your mind? Choose <strong>Keep yearly billing</strong> in{" "}
            <Link to="/account#plan">Account</Link>.
          </p>
        </div>
      )}

      {confirmed && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            You're on <strong>{planById.get(confirmed)!.name}</strong>. We've emailed a confirmation with your price,
            renewal date and how to cancel.
          </p>
        </div>
      )}

      <fieldset className="segmented billing-toggle">
        <legend>Billing</legend>
        <div>
          {(["month", "year"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="billing-interval"
                value={value}
                checked={interval === value}
                onChange={() => {
                  setBillingInterval(value);
                  setAgreed(false);
                }}
              />
              <span>{value === "month" ? "Monthly" : "Yearly: 2 months free"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="plan-grid">
        {plans.map((p) => {
          const current = account?.planId === p.id && account.billingInterval === interval;
          // Already chosen for monthly billing from the renewal date.
          const scheduled = !yearly && account?.billingInterval === "year" && account.switchToMonthly === p.id;
          const samePlan = account?.planId === p.id;
          const isSelected = selected === p.id;
          return (
            <li key={p.id} className={`plan-card${isSelected ? " is-selected" : ""}${current ? " is-current" : ""}`}>
              <h2>{p.name}</h2>
              <p className="plan-summary">{p.summary}</p>
              <p className="plan-price">
                <strong>{formatPrice(priceFor(p, interval))}</strong>
                <span>{yearly ? "/year" : "/month"}</span>
                {yearly && <small>{formatPrice(p.yearlyPrice / 12)} a month, instead of {formatPrice(p.price)}</small>}
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
              ) : scheduled ? (
                <p className="plan-current">
                  <Icon name="calendar" size={16} /> Monthly from {renewalDate}
                </p>
              ) : complimentary ? null : (
                <button
                  type="button"
                  className={isSelected ? "primary-button is-on" : "primary-button"}
                  aria-pressed={account ? isSelected : undefined}
                  onClick={() => choose(p)}
                >
                  {samePlan ? `Switch to ${yearly ? "yearly" : "monthly"}` : account?.planId ? `Switch to ${p.name}` : `Choose ${p.name}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {plan && account && !complimentary && (
        <section className="checkout" aria-labelledby="checkout-title">
          <h2 id="checkout-title" ref={checkoutRef} tabIndex={-1}>
            Confirm {plan.name}, {yearly ? "yearly" : "monthly"}
          </h2>
          {toMonthlyFromYearly && account.endsAt ? (
            <div className="form-alert">
              <Icon name="alert" size={17} />
              <p>
                Your membership is set to end. Choose <strong>Keep my membership</strong> in <Link to="/account#plan">Account</Link> first, or
                choose monthly once it ends.
              </p>
            </div>
          ) : tooBig.length > 0 ? (
            <div className="form-alert plan-too-big">
              <Icon name="alert" size={17} />
              <div>
                {tooBig.map((problem) => (
                  <p key={problem}>{problem}</p>
                ))}
                <div className="plan-too-big-actions">
                  <Link to="/profiles">Who's reading?</Link>
                  <Link to="/account#plan">Account</Link>
                  <button type="button" className="text-button" onClick={() => setSelected(null)}>
                    Keep my plan
                  </button>
                </div>
              </div>
            </div>
          ) : isDemo ? (
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
                  <dd>
                    {formatPrice(price)} {per}, plus any applicable tax
                    {yearly && ` (${formatPrice(plan.price * 12)} paid monthly)`}
                  </dd>
                </div>
                {changingPaid ? (
                  <div>
                    <dt>When it changes</dt>
                    <dd>{changeWhen}</dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>First charge</dt>
                      <dd>{yearly ? `Today, for the year` : billsToday ? "Today" : "Today, for the days until your billing day"}</dd>
                    </div>
                    <div>
                      <dt>Next charge</dt>
                      <dd>{longDate(yearly ? oneYearAfter(startsOn) : nextBillingDate(billingDay))}</dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="checkout-fields">
                {!changingPaid && !yearly && (
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
                )}

                {!changingPaid && (
                  <div className="card-note">
                    <Icon name="lock" size={17} />
                    <p>
                      Next, you'll enter your card on Stripe's secure payment page. Card details go straight to Stripe and never
                      reach LiteraryWorm. Have a promo code? Add it there.
                    </p>
                  </div>
                )}

                <p className="renewal-terms">
                  {yearly
                    ? `Your membership renews automatically every year on ${changingPaid && fromYearly && account?.renewsAt ? "your renewal date" : "the date your year starts"} at ${formatPrice(price)} until you cancel. We'll remind you 30 days before.`
                    : toMonthlyFromYearly
                      ? `From ${renewalDate}, your membership renews automatically every month on that day at ${formatPrice(price)} until you cancel.`
                      : `Your membership renews automatically every month on the ${ordinal(changingPaid && account?.billingDay ? account.billingDay : renewalDay)} at ${formatPrice(price)} until you cancel.`}{" "}
                  Cancel online any time from Account; you'll keep access until the end of the period you've paid for. To stop a
                  charge, cancel at least {CANCEL_NOTICE_HOURS} hours before that billing date. No refunds.
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
                    {saving
                      ? changingPaid
                        ? "Switching your plan…"
                        : "Opening the payment page…"
                      : toMonthlyFromYearly
                        ? `Pay monthly from ${renewalDate}: ${plan.name}, ${formatPrice(price)}/month`
                        : changingPaid
                        ? `Switch to ${plan.name} for ${formatPrice(price)}${yearly ? "/year" : "/month"}`
                        : `Continue to payment: ${plan.name}, ${formatPrice(price)}${yearly ? "/year" : "/month"}`}
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

      {!complimentary && (
        <section className="plans-gifts" aria-labelledby="plans-gifts-title">
          <h2 id="plans-gifts-title">Gifts</h2>
          <p>
            Give months of any plan, paid once, with a code to pass on.{" "}
            {account?.userId && !account.isDemo ? (
              <Link to="/gifts">Buy a gift</Link>
            ) : (
              <>
                <Link to="/signin">Log in</Link> or <Link to="/signup">create an account</Link> to buy one or redeem one.
              </>
            )}
          </p>
          {account?.userId && !account.isDemo && (
            <RedeemGift account={account} onStarted={() => navigate(setup ? "/profiles?setup=1" : "/account#plan")} />
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
        <WhatsNewLink />
      </section>
    </div>
  );
}
