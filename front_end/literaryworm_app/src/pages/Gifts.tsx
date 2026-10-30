import { type FormEvent, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { RedeemGift } from "../components/RedeemGift";
import { formatPrice, planById, plans } from "../data/plans";
import { AccountError, type BoughtGift, buyGift, myGifts } from "../lib/accountApi";
import { endDate, formatMoney } from "../lib/billing";
import { formatGiftCode, GIFT_MONTHS, GIFT_YEAR_MONTHS, giftNotStarted, giftPriceCents, giftStartBounds, giftStartError, monthsLabel } from "../lib/gifts";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";
import type { PlanId } from "../types";

/**
 * /gifts: buy a gift membership (a one-off Stripe Checkout payment), see the codes bought, and
 * redeem one. Codes are made by the stripe-webhook function once Stripe confirms payment, so on
 * the way back from Checkout this looks for the new code for a little while.
 */
export default function Gifts() {
  useTitle("Gifts");
  const account = useStore().state.account;
  const profile = useActiveProfile();
  const [params] = useSearchParams();
  const result = params.get("checkout");

  if (!account) return null;
  if (profile?.ageRating === "kids") {
    return (
      <div className="page gifts-page">
        <h1>Gifts</h1>
        <p className="account-sub">A grown-up can buy and redeem gifts from their own profile.</p>
      </div>
    );
  }
  const live = Boolean(account.userId) && !account.isDemo;

  return (
    <div className="page gifts-page">
      <header className="gifts-intro">
        <p className="eyebrow">Gifts</p>
        <h1>Give LiteraryWorm</h1>
        <p className="account-sub">
          Months of any plan, paid once. You get a code to pass on; they redeem it in Account. Codes don't expire and nothing renews
          on your card.
        </p>
      </header>

      {result === "cancelled" && (
        <div className="form-alert" role="status">
          <Icon name="alert" size={17} />
          <p>You left the payment page, so nothing was charged.</p>
        </div>
      )}

      {!live ? (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <p>
            The demo account can't make payments. <Link to="/signup">Create an account</Link> to give a gift.
          </p>
        </div>
      ) : account.complimentary ? (
        <p className="field-hint">Staff accounts are never charged, so they can't buy gifts.</p>
      ) : (
        <BuyGift />
      )}

      {live && <YourGifts justPaid={result === "success"} />}

      {live && !account.complimentary && (
        <section className="gifts-section" aria-label="Redeem a gift">
          <RedeemGift account={account} />
        </section>
      )}
    </div>
  );
}

function BuyGift() {
  const id = useId();
  const [planId, setPlanId] = useState<PlanId>("standard");
  const [months, setMonths] = useState<number>(3);
  // Straight away, or a later day (a birthday, say): the code works from then.
  const [later, setLater] = useState(false);
  const [startsOn, setStartsOn] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bounds = giftStartBounds();
  const plan = planById.get(planId)!;
  const total = giftPriceCents(plan, months);
  const yearSaving = Math.round(plan.price * 100) * GIFT_YEAR_MONTHS - giftPriceCents(plan, GIFT_YEAR_MONTHS);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = later ? giftStartError(startsOn) : null;
    setStartError(problem);
    if (problem) {
      document.getElementById(`${id}-starts`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await buyGift(planId, months, later ? startsOn : null));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "We couldn't start the payment. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="gifts-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Buy a gift</h2>
      <form className="gift-form" onSubmit={submit}>
        <fieldset className="gift-choice">
          <legend className="field-label">Plan</legend>
          <div className="gift-plans">
            {plans.map((p) => (
              <label key={p.id} className={`gift-plan${p.id === planId ? " is-on" : ""}`}>
                <input type="radio" name={`${id}-plan`} value={p.id} checked={p.id === planId} onChange={() => setPlanId(p.id)} />
                <span className="gift-plan-text">
                  <strong>{p.name}</strong>
                  <span>
                    {formatPrice(p.price)} a month · {p.profiles === 1 ? "1 profile" : `up to ${p.profiles} profiles`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="gift-choice">
          <legend className="field-label">How long</legend>
          <div className="chip-group chip-group-lg gift-months">
            {GIFT_MONTHS.map((m) => (
              <label key={m} className="chip">
                <input type="radio" name={`${id}-months`} value={m} checked={m === months} onChange={() => setMonths(m)} />
                <span>{m === GIFT_YEAR_MONTHS ? "A year: 2 months free" : monthsLabel(m)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="gift-choice">
          <legend className="field-label">When it starts</legend>
          <div className="chip-group chip-group-lg">
            <label className="chip">
              <input type="radio" name={`${id}-when`} checked={!later} onChange={() => setLater(false)} />
              <span>Straight away</span>
            </label>
            <label className="chip">
              <input type="radio" name={`${id}-when`} checked={later} onChange={() => setLater(true)} />
              <span>On a later day</span>
            </label>
          </div>
          {later && (
            <div className="field gift-start">
              <label className="field-label" htmlFor={`${id}-starts`}>
                Start day
              </label>
              <input
                id={`${id}-starts`}
                className="field-input"
                type="date"
                min={bounds.min}
                max={bounds.max}
                value={startsOn}
                aria-invalid={startError ? true : undefined}
                aria-describedby={startError ? `${id}-starts-error` : `${id}-starts-hint`}
                onChange={(e) => {
                  setStartsOn(e.target.value);
                  setStartError(null);
                }}
              />
              <p className="field-hint" id={`${id}-starts-hint`}>
                For a birthday, say. You get the code now to pass on; it can be redeemed from that day, up to a year ahead.
              </p>
              {startError && (
                <p className="field-error" id={`${id}-starts-error`} role="alert">
                  <Icon name="alert" size={15} />
                  {startError}
                </p>
              )}
            </div>
          )}
        </fieldset>
        <div className="gift-total">
          <p>
            <strong>{formatMoney(total, "usd")}</strong> for {months === GIFT_YEAR_MONTHS ? "a year" : monthsLabel(months)} of {plan.name}, paid once.
            {months === GIFT_YEAR_MONTHS && ` That's the yearly price: ${formatMoney(yearSaving, "usd")} less than 12 months.`}
            {later && startsOn && !giftStartError(startsOn) && ` It can be redeemed from ${endDate(startsOn)}.`}
          </p>
          <p className="field-hint">
            Paid on Stripe's secure page. Your code appears below once payment goes through. All sales are final.
          </p>
          <button type="submit" className="primary-button" disabled={busy}>
            Continue to payment
          </button>
          {error && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={15} />
              {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function YourGifts({ justPaid }: { justPaid: boolean }) {
  const id = useId();
  const [gifts, setGifts] = useState<BoughtGift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<"waiting" | "slow" | null>(justPaid ? "waiting" : null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let tries = 0;
    let first: number | null = null;
    // Back from Stripe: the webhook makes the code a moment later, so look again until it's there.
    const look = async () => {
      if (stopped) return;
      tries += 1;
      try {
        const list = await myGifts();
        if (stopped) return;
        first ??= list.length;
        setGifts(list);
        const fresh = list[0] && Date.now() - new Date(list[0].createdAt).getTime() < 10 * 60 * 1000;
        if (!justPaid || fresh) {
          setWaiting(null);
          return;
        }
      } catch (err) {
        if (!justPaid || tries === 1) setError(err instanceof AccountError ? err.message : "We couldn't load your gifts. Try again.");
        if (!justPaid) return;
      }
      if (tries >= 15) setWaiting("slow");
      else window.setTimeout(look, 2000);
    };
    void look();
    return () => {
      stopped = true;
    };
  }, [justPaid]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(formatGiftCode(code));
      setCopied(code);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="gifts-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Your gifts</h2>
      {waiting && (
        <div className={waiting === "slow" ? "form-alert" : "form-success"} role="status">
          <Icon name={waiting === "slow" ? "alert" : "check"} size={17} />
          <p>
            {waiting === "slow"
              ? "Payment went through, and your code is taking longer than usual. Refresh this page in a minute."
              : "Thank you. Your gift code will appear here in a moment."}
          </p>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
      {gifts && gifts.length === 0 && !waiting && <p className="field-hint">Gifts you buy appear here, with their codes.</p>}
      {gifts && gifts.length > 0 && (
        <ul className="gift-list" role="list">
          {gifts.map((g) => (
            <li key={g.id}>
              <div>
                <p className="gift-code">{formatGiftCode(g.code)}</p>
                <p className="gift-meta">
                  {monthsLabel(g.months)} of {planById.get(g.planId)?.name ?? g.planId} · {formatMoney(g.amountCents, g.currency)} ·
                  bought {endDate(g.createdAt)}
                  {!g.redeemedAt && giftNotStarted(g.startsOn) && ` · starts ${endDate(g.startsOn!)}`}
                </p>
              </div>
              <span className={`status-pill ${g.redeemedAt ? "status-paused" : "status-active"}`}>
                {g.redeemedAt ? `Redeemed ${endDate(g.redeemedAt)}` : "Not redeemed yet"}
              </span>
              {!g.redeemedAt && (
                <button type="button" className="secondary-button" onClick={() => void copy(g.code)}>
                  {copied === g.code ? "Copied" : "Copy code"}
                  <span className="visually-hidden"> {formatGiftCode(g.code)}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="visually-hidden">
        {copied ? `Copied ${formatGiftCode(copied)}` : ""}
      </p>
    </section>
  );
}
