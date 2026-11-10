import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { RedeemGift } from "../components/RedeemGift";
import { WhatsNewLink } from "../components/WhatsNewLink";
import { FREE_TRIAL_DAYS, formatPrice, perPeriod, planById, planFaqs, plans, priceFor } from "../data/plans";
import { StructuredData } from "../components/StructuredData";
import { AccountError, choosePlan, listOfflineDevices, loadAccount, planFields } from "../lib/accountApi";
import { CANCEL_NOTICE_HOURS, endDate, longDate, nextBillingDate, oneYearAfter, ordinal } from "../lib/billing";
import { profilesInUse, tooBigFor } from "../lib/planLimits";
import { faqData, membershipData, plansDescription, HOME_CRUMB, MEMBERSHIP_ID, pageData } from "../lib/seo";
import { useTitle } from "../lib/useTitle";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";
import type { BillingInterval, Plan, PlanId } from "../types";

export default function Plans() {
  const t = useT();
  useTitle(t("Plans and pricing"), plansDescription());
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
        setSaveError(err instanceof AccountError ? err.message : t("We couldn't start your plan. Try again."));
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
  // A first membership (never a member before, not on staff) starts with a free week; checkout decides the same.
  const freeWeek = !changingPaid && (!account || (!account.planId && !account.memberSince && !account.complimentary));
  const freeWeekEnds = longDate(new Date(Date.now() + FREE_TRIAL_DAYS * 86_400_000));
  const price = plan ? priceFor(plan, interval) : 0;
  const per = perPeriod(interval);
  // Moving a paid membership: monthly to yearly starts the year today; a yearly one moves up today
  // (paying the difference for the rest of the year) or down at renewal, and to monthly at renewal.
  const fromYearly = changingPaid && yearlyNow;
  const toMonthlyFromYearly = fromYearly && !yearly;
  const renewalDate = account?.renewsAt ? endDate(account.renewsAt) : t("your renewal date");
  const renewalDay = account?.renewsAt ? Math.min(new Date(account.renewsAt).getUTCDate(), 28) : billingDay;
  const yearlyUpgrade = Boolean(fromYearly && yearly && plan && account?.planId && plan.price > planById.get(account.planId)!.price);
  const changeWhen = !changingPaid
    ? null
    : toMonthlyFromYearly
      ? t("On {date}, when your year would renew. Nothing is charged or refunded today; your year carries on as it is.", { date: renewalDate })
      : yearly && !fromYearly
      ? t("Today. Your year starts now, and the unused part of this month comes off the first yearly charge.")
      : yearlyUpgrade
        ? t("Today. You pay the difference for the rest of your year now, and the new price from your renewal date.")
        : fromYearly
          ? t("From your renewal date. Nothing is charged today.")
          : t("From your next billing date. Nothing is charged today.");

  return (
    <div className="plans-page">
      <header className="plans-intro">
        {setup && account && !account.planId ? (
          <>
            <p className="eyebrow">{t("Step 2 of 3")}</p>
            <h1>{t("Choose your plan, {name}", { name: account.name.split(" ")[0] })}</h1>
            <p>{t("Every plan includes the full ebook catalog. Pick how much listening and how many profiles you need.")}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">{t("Pricing")}</p>
            <h1>{t("One membership for every reader at home")}</h1>
            <p>{t("Ebooks and audiobooks in one place. Prices are in US dollars. Pay monthly, or yearly with two months free. Cancel online any time.")}</p>
          </>
        )}
      </header>

      {waiting && (
        <div className={waiting === "slow" ? "form-alert" : "form-success"} role="status">
          <Icon name={waiting === "slow" ? "alert" : "check"} size={18} />
          <p>
            {waiting === "slow"
              ? t("Your payment went through, but your membership is taking longer than usual to appear. Refresh this page in a minute, or email support@literaryworm.com if it doesn't.")
              : t("Payment received. Setting up your membership…")}
          </p>
        </div>
      )}

      {checkoutResult === "cancelled" && (
        <div className="form-alert" role="status">
          <Icon name="alert" size={18} />
          <p>{t("You left the payment page, so nothing was charged. Choose a plan when you're ready.")}</p>
        </div>
      )}

      {complimentary && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            {rich(t("Your staff account has a complimentary {plan} membership. It's never charged, so there's no plan to choose."), { plan: <strong>{planById.get(account?.planId ?? "basic")?.name ?? "Basic"}</strong> })}
          </p>
        </div>
      )}

      {switched && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            {rich(t("Done. Your year carries on as it is, then you'll pay {price} for {plan} from {date}. Changed your mind? Choose {keep} in {account}."), {
              price: <strong>{t("{price} a month", { price: formatPrice(planById.get(switched)!.price) })}</strong>,
              plan: planById.get(switched)!.name,
              date: renewalDate,
              keep: <strong>{t("Keep yearly billing")}</strong>,
              account: <Link to="/account#plan">{t("Account")}</Link>,
            })}
          </p>
        </div>
      )}

      {confirmed && (
        <div className="form-success" role="status">
          <Icon name="check" size={18} />
          <p>
            {rich(t("You're on {plan}. We've emailed a confirmation with your price, renewal date and how to cancel."), {
              plan: <strong>{planById.get(confirmed)!.name}</strong>,
            })}
          </p>
        </div>
      )}

      <fieldset className="segmented billing-toggle">
        <legend>{t("Billing")}</legend>
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
              <span>{value === "month" ? t("Monthly") : t("Yearly: 2 months free")}</span>
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
              <p className="plan-summary">{t(p.summary)}</p>
              <p className="plan-price">
                <strong>{formatPrice(priceFor(p, interval))}</strong>
                <span>{yearly ? t("/year") : t("/month")}</span>
                {yearly && <small>{t("{price} a month, instead of {full}", { price: formatPrice(p.yearlyPrice / 12), full: formatPrice(p.price) })}</small>}
                {freeWeek && <small className="plan-trial">{t("First {n} days free", { n: FREE_TRIAL_DAYS })}</small>}
              </p>
              <ul className="plan-features">
                <li>
                  <Icon name="users" size={17} />
                  {p.profiles === 1 ? t("1 profile") : t("Up to {n} profiles", { n: p.profiles })}
                </li>
                <li>
                  <Icon name="headphones" size={17} />
                  {t(p.audioHours)}
                </li>
                <li>
                  <Icon name="download" size={17} />
                  {t(p.downloads)}
                </li>
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={17} />
                    {t(f)}
                  </li>
                ))}
              </ul>
              {current ? (
                <p className="plan-current">
                  <Icon name="check" size={16} /> {t("Your current plan")}
                </p>
              ) : scheduled ? (
                <p className="plan-current">
                  <Icon name="calendar" size={16} /> {t("Monthly from {date}", { date: renewalDate })}
                </p>
              ) : complimentary ? null : (
                <button
                  type="button"
                  className={isSelected ? "primary-button is-on" : "primary-button"}
                  aria-pressed={account ? isSelected : undefined}
                  onClick={() => choose(p)}
                >
                  {samePlan ? (yearly ? t("Switch to yearly") : t("Switch to monthly")) : account?.planId ? t("Switch to {plan}", { plan: p.name }) : t("Choose {plan}", { plan: p.name })}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {plan && account && !complimentary && (
        <section className="checkout" aria-labelledby="checkout-title">
          <h2 id="checkout-title" ref={checkoutRef} tabIndex={-1}>
            {yearly ? t("Confirm {plan}, yearly", { plan: plan.name }) : t("Confirm {plan}, monthly", { plan: plan.name })}
          </h2>
          {toMonthlyFromYearly && account.endsAt ? (
            <div className="form-alert">
              <Icon name="alert" size={17} />
              <p>
                {rich(t("Your membership is set to end. Choose {keep} in {account} first, or choose monthly once it ends."), {
                  keep: <strong>{t("Keep my membership")}</strong>,
                  account: <Link to="/account#plan">{t("Account")}</Link>,
                })}
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
                  <Link to="/profiles">{t("Who's reading?")}</Link>
                  <Link to="/account#plan">{t("Account")}</Link>
                  <button type="button" className="text-button" onClick={() => setSelected(null)}>
                    {t("Keep my plan")}
                  </button>
                </div>
              </div>
            </div>
          ) : isDemo ? (
            <div className="form-alert">
              <Icon name="alert" size={17} />
              <p>
                {rich(t("The demo account can't make payments. {link} to choose a plan."), { link: <Link to="/signup">{t("Create an account")}</Link> })}
              </p>
            </div>
          ) : (
            <form className="checkout-grid" noValidate onSubmit={confirm}>
              <dl className="checkout-summary">
                <div>
                  <dt>{t("Plan")}</dt>
                  <dd>{plan.name}</dd>
                </div>
                <div>
                  <dt>{t("Price")}</dt>
                  <dd>
                    {t("{price} {per}, plus any applicable tax", { price: formatPrice(price), per })}
                    {yearly && t(" ({price} paid monthly)", { price: formatPrice(plan.price * 12) })}
                  </dd>
                </div>
                {changingPaid ? (
                  <div>
                    <dt>{t("When it changes")}</dt>
                    <dd>{changeWhen}</dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>{t("First charge")}</dt>
                      <dd>
                        {freeWeek
                          ? t("{date}, when your free week ends", { date: freeWeekEnds })
                          : yearly
                            ? t("Today, for the year")
                            : billsToday
                              ? t("Today")
                              : t("Today, for the days until your billing day")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("Next charge")}</dt>
                      <dd>
                        {freeWeek
                          ? yearly
                            ? t("A year after the first")
                            : t("A month after the first, then monthly on that day")
                          : longDate(yearly ? oneYearAfter(startsOn) : nextBillingDate(billingDay))}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="checkout-fields">
                {!changingPaid && !yearly && !freeWeek && (
                <div className="field">
                  <label className="field-label" htmlFor="billing-day">
                    {t("Billing day")}
                  </label>
                  <select
                    id="billing-day"
                    className="field-input"
                    value={billingDay}
                    onChange={(e) => setBillingDay(Number(e.target.value))}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {t("The {day} of each month", { day: ordinal(d) })}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">{t("You can change this later in Account.")}</p>
                </div>
                )}

                {!changingPaid && (
                  <div className="card-note">
                    <Icon name="lock" size={17} />
                    <p>
                      {t("Next, you'll enter your card on Stripe's secure payment page. Card details go straight to Stripe and never reach LiteraryWorm. Have a promo code? Add it there.")}
                    </p>
                  </div>
                )}

                <p className="renewal-terms">
                  {freeWeek && (
                    <>
                      {t("Your first {n} days are free: cancel in Account before {date} and you won't be charged.", { n: FREE_TRIAL_DAYS, date: freeWeekEnds })}{" "}
                    </>
                  )}
                  {freeWeek
                    ? yearly
                      ? t("Then your membership renews automatically every year from {date} at {price} until you cancel. We'll remind you 30 days before.", { date: freeWeekEnds, price: formatPrice(price) })
                      : t("Then your membership renews automatically every month from {date} at {price} until you cancel.", { date: freeWeekEnds, price: formatPrice(price) })
                    : yearly
                    ? changingPaid && fromYearly && account?.renewsAt
                      ? t("Your membership renews automatically every year on your renewal date at {price} until you cancel. We'll remind you 30 days before.", { price: formatPrice(price) })
                      : t("Your membership renews automatically every year on the date your year starts at {price} until you cancel. We'll remind you 30 days before.", { price: formatPrice(price) })
                    : toMonthlyFromYearly
                      ? t("From {date}, your membership renews automatically every month on that day at {price} until you cancel.", { date: renewalDate, price: formatPrice(price) })
                      : t("Your membership renews automatically every month on the {day} at {price} until you cancel.", {
                          day: ordinal(changingPaid && account?.billingDay ? account.billingDay : renewalDay),
                          price: formatPrice(price),
                        })}{" "}
                  {t("Cancel online any time from Account; you'll keep access until the end of the period you've paid for. To stop a charge, cancel at least {hours} hours before that billing date. No refunds.", { hours: CANCEL_NOTICE_HOURS })}
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
                  <span>{t("I understand my membership renews automatically until I cancel.")}</span>
                </label>
                {agreeError && (
                  <p className="field-error" id="agree-error">
                    <Icon name="alert" size={15} />
                    {t("Confirm you understand the renewal terms to continue.")}
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
                        ? t("Switching your plan…")
                        : t("Opening the payment page…")
                      : toMonthlyFromYearly
                        ? t("Pay monthly from {date}: {plan}, {price}/month", { date: renewalDate, plan: plan.name, price: formatPrice(price) })
                        : changingPaid
                        ? yearly
                          ? t("Switch to {plan} for {price}/year", { plan: plan.name, price: formatPrice(price) })
                          : t("Switch to {plan} for {price}/month", { plan: plan.name, price: formatPrice(price) })
                        : yearly
                          ? t("Continue to payment: {plan}, {price}/year", { plan: plan.name, price: formatPrice(price) })
                          : t("Continue to payment: {plan}, {price}/month", { plan: plan.name, price: formatPrice(price) })}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setSelected(null)}>
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      {!complimentary && (
        <section className="plans-gifts" aria-labelledby="plans-gifts-title">
          <h2 id="plans-gifts-title">{t("Gifts")}</h2>
          <p>
            {t("Give months of any plan, paid once, with a code to pass on.")}{" "}
            {account?.userId && !account.isDemo ? (
              <Link to="/gifts">{t("Buy a gift")}</Link>
            ) : (
              rich(t("{login} or {signup} to buy one or redeem one."), {
                login: <Link to="/signin">{t("Log in")}</Link>,
                signup: <Link to="/signup">{t("create an account")}</Link>,
              })
            )}
          </p>
          {account?.userId && !account.isDemo && (
            <RedeemGift account={account} onStarted={() => navigate(setup ? "/profiles?setup=1" : "/account#plan")} />
          )}
        </section>
      )}

      <StructuredData
        id="page"
        data={pageData({
          path: "/pricing",
          name: "Plans and pricing",
          description: plansDescription(),
          crumbs: [HOME_CRUMB, { name: "Plans and pricing", path: "/pricing" }],
          mainEntity: { "@id": MEMBERSHIP_ID },
        })}
      />
      <StructuredData id="membership" data={membershipData()} />
      <StructuredData id="faq" data={faqData(planFaqs)} />
      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">{t("Questions about plans")}</h2>
        <div className="faq-list">
          {planFaqs.map((f) => (
            <details key={f.q}>
              <summary>
                {t(f.q)}
                <Icon name="chevronDown" size={18} />
              </summary>
              {t(f.a).split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </details>
          ))}
        </div>
        <WhatsNewLink />
      </section>
    </div>
  );
}
