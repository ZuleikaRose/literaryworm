import { type FormEvent, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { RedeemGift } from "../components/RedeemGift";
import { formatPrice, planById, plans } from "../data/plans";
import { getBook } from "../data/books";
import { GiftBooksPicker } from "../components/GiftBooksPicker";
import { AccountError, type BoughtGift, buyGift, myGifts } from "../lib/accountApi";
import { endDate, formatMoney } from "../lib/billing";
import {
  formatGiftCode,
  GIFT_MESSAGE_MAX,
  GIFT_MONTHS,
  GIFT_YEAR_MONTHS,
  giftNotStarted,
  giftPriceCents,
  giftRecipientError,
  giftStartBounds,
  giftStartError,
  monthsLabel,
} from "../lib/gifts";
import { rich, tr } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";
import type { PlanId } from "../types";

/**
 * /gifts: buy a gift membership (a one-off Stripe Checkout payment), see the codes bought, and
 * redeem one. Codes are made by the stripe-webhook function once Stripe confirms payment, so on
 * the way back from Checkout this looks for the new code for a little while.
 */
export default function Gifts() {
  const t = useT();
  useTitle(t("Gifts"));
  const account = useStore().state.account;
  const profile = useActiveProfile();
  const [params] = useSearchParams();
  const result = params.get("checkout");

  if (!account) return null;
  if (profile?.ageRating === "kids") {
    return (
      <div className="page gifts-page">
        <h1>{t("Gifts")}</h1>
        <p className="account-sub">{t("A grown-up can buy and redeem gifts from their own profile.")}</p>
      </div>
    );
  }
  const live = Boolean(account.userId) && !account.isDemo;

  return (
    <div className="page gifts-page">
      <header className="gifts-intro">
        <p className="eyebrow">{t("Gifts")}</p>
        <h1>{t("Give LiteraryWorm")}</h1>
        <p className="account-sub">
          {t("Months of any plan, paid once. You get a code to pass on, or we email it to them; they redeem it in Account. Codes don't expire and nothing renews on your card.")}
        </p>
      </header>

      {result === "cancelled" && (
        <div className="form-alert" role="status">
          <Icon name="alert" size={17} />
          <p>{t("You left the payment page, so nothing was charged.")}</p>
        </div>
      )}

      {!live ? (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <p>
            {rich(t("The demo account can't make payments. {link} to give a gift."), { link: <Link to="/signup">{t("Create an account")}</Link> })}
          </p>
        </div>
      ) : account.complimentary ? (
        <p className="field-hint">{t("Staff accounts are never charged, so they can't buy gifts.")}</p>
      ) : (
        <BuyGift />
      )}

      {live && <YourGifts justPaid={result === "success"} />}

      {live && !account.complimentary && (
        <section className="gifts-section" aria-label={t("Redeem a gift")}>
          <RedeemGift account={account} initialCode={params.get("code") ?? ""} />
        </section>
      )}
    </div>
  );
}

function BuyGift() {
  const t = useT();
  const id = useId();
  const [planId, setPlanId] = useState<PlanId>("standard");
  const [months, setMonths] = useState<number>(3);
  // Straight away, or a later day (a birthday, say): the code works from then.
  const [later, setLater] = useState(false);
  const [startsOn, setStartsOn] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  // Hand the code over yourself, or have us email it to them when it can be redeemed.
  const [byEmail, setByEmail] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // LiteraryWorm books that come with the gift (components/GiftBooksPicker.tsx).
  const [books, setBooks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bounds = giftStartBounds();
  const plan = planById.get(planId)!;
  const total = giftPriceCents(plan, months);
  const yearSaving = Math.round(plan.price * 100) * GIFT_YEAR_MONTHS - giftPriceCents(plan, GIFT_YEAR_MONTHS);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = later ? giftStartError(startsOn) : null;
    const toProblem = byEmail ? giftRecipientError(recipient) : null;
    setStartError(problem);
    setRecipientError(toProblem);
    if (problem || toProblem) {
      document.getElementById(problem ? `${id}-starts` : `${id}-to`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await buyGift(planId, months, later ? startsOn : null, byEmail ? { email: recipient, message } : null, books));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("We couldn't start the payment. Try again."));
      setBusy(false);
    }
  }

  return (
    <section className="gifts-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Buy a gift")}</h2>
      <form className="gift-form" onSubmit={submit}>
        <fieldset className="gift-choice">
          <legend className="field-label">{t("Plan")}</legend>
          <div className="gift-plans">
            {plans.map((p) => (
              <label key={p.id} className={`gift-plan${p.id === planId ? " is-on" : ""}`}>
                <input type="radio" name={`${id}-plan`} value={p.id} checked={p.id === planId} onChange={() => setPlanId(p.id)} />
                <span className="gift-plan-text">
                  <strong>{p.name}</strong>
                  <span>
                    {t("{price} a month", { price: formatPrice(p.price) })} · {p.profiles === 1 ? t("1 profile") : t("up to {n} profiles", { n: p.profiles })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="gift-choice">
          <legend className="field-label">{t("How long")}</legend>
          <div className="chip-group chip-group-lg gift-months">
            {GIFT_MONTHS.map((m) => (
              <label key={m} className="chip">
                <input type="radio" name={`${id}-months`} value={m} checked={m === months} onChange={() => setMonths(m)} />
                <span>{m === GIFT_YEAR_MONTHS ? t("A year: 2 months free") : monthsLabel(m)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="gift-choice">
          <legend className="field-label">{t("When it starts")}</legend>
          <div className="chip-group chip-group-lg">
            <label className="chip">
              <input type="radio" name={`${id}-when`} checked={!later} onChange={() => setLater(false)} />
              <span>{t("Straight away")}</span>
            </label>
            <label className="chip">
              <input type="radio" name={`${id}-when`} checked={later} onChange={() => setLater(true)} />
              <span>{t("On a later day")}</span>
            </label>
          </div>
          {later && (
            <div className="field gift-start">
              <label className="field-label" htmlFor={`${id}-starts`}>
                {t("Start day")}
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
                {t("For a birthday, say. You get the code now; it can be redeemed from that day, up to a year ahead.")}{" "}
                {byEmail ? t("We'll email it to them that morning.") : t("We'll email you three days before.")}
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
        <fieldset className="gift-choice">
          <legend className="field-label">{t("How they get it")}</legend>
          <div className="chip-group chip-group-lg">
            <label className="chip">
              <input type="radio" name={`${id}-how`} checked={!byEmail} onChange={() => setByEmail(false)} />
              <span>{t("I'll pass the code on")}</span>
            </label>
            <label className="chip">
              <input type="radio" name={`${id}-how`} checked={byEmail} onChange={() => setByEmail(true)} />
              <span>{t("Email it to them")}</span>
            </label>
          </div>
          {byEmail && (
            <div className="gift-recipient">
              <div className="field">
                <label className="field-label" htmlFor={`${id}-to`}>
                  {t("Their email address")}
                </label>
                <input
                  id={`${id}-to`}
                  className="field-input"
                  type="email"
                  autoComplete="off"
                  value={recipient}
                  aria-invalid={recipientError ? true : undefined}
                  aria-describedby={recipientError ? `${id}-to-error` : `${id}-to-hint`}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setRecipientError(null);
                  }}
                />
                <p className="field-hint" id={`${id}-to-hint`}>
                  {later
                    ? t("We email them the code on the start day, then forget the address. You still see the code below.")
                    : t("We email them the code within the hour, then forget the address. You still see the code below.")}
                </p>
                {recipientError && (
                  <p className="field-error" id={`${id}-to-error`} role="alert">
                    <Icon name="alert" size={15} />
                    {recipientError}
                  </p>
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${id}-message`}>
                  {t("A message (optional)")}
                </label>
                <textarea
                  id={`${id}-message`}
                  className="field-input"
                  rows={3}
                  maxLength={GIFT_MESSAGE_MAX}
                  value={message}
                  aria-describedby={`${id}-message-hint`}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="field-hint" id={`${id}-message-hint`}>
                  {t("Up to {max} characters, sent with the code under your display name.", { max: GIFT_MESSAGE_MAX })}
                </p>
              </div>
            </div>
          )}
        </fieldset>
        <GiftBooksPicker books={books} onChange={setBooks} />
        <div className="gift-total">
          <p>
            {rich(t("{price} for {period} of {plan}, paid once."), {
              price: <strong>{formatMoney(total, "usd")}</strong>,
              period: months === GIFT_YEAR_MONTHS ? t("a year") : monthsLabel(months),
              plan: plan.name,
            })}
            {months === GIFT_YEAR_MONTHS && " " + t("That's the yearly price: {saving} less than 12 months.", { saving: formatMoney(yearSaving, "usd") })}
            {later && startsOn && !giftStartError(startsOn) && " " + t("It can be redeemed from {date}.", { date: endDate(startsOn) })}
            {books.length > 0 && " " + t.plural(books.length, { one: "With {count} book to start them off.", other: "With {count} books to start them off." })}
          </p>
          <p className="field-hint">
            {t("Paid on Stripe's secure page. Your code appears below once payment goes through. All sales are final.")}
          </p>
          <button type="submit" className="primary-button" disabled={busy}>
            {t("Continue to payment")}
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
  const t = useT();
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
        if (!justPaid || tries === 1) setError(err instanceof AccountError ? err.message : tr("We couldn't load your gifts. Try again."));
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
      <h2 id={`${id}-title`}>{t("Your gifts")}</h2>
      {waiting && (
        <div className={waiting === "slow" ? "form-alert" : "form-success"} role="status">
          <Icon name={waiting === "slow" ? "alert" : "check"} size={17} />
          <p>
            {waiting === "slow"
              ? t("Payment went through, and your code is taking longer than usual. Refresh this page in a minute.")
              : t("Thank you. Your gift code will appear here in a moment.")}
          </p>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
      {gifts && gifts.length === 0 && !waiting && <p className="field-hint">{t("Gifts you buy appear here, with their codes.")}</p>}
      {gifts && gifts.length > 0 && (
        <ul className="gift-list" role="list">
          {gifts.map((g) => (
            <li key={g.id}>
              <div>
                <p className="gift-code">{formatGiftCode(g.code)}</p>
                <p className="gift-meta">
                  {t("{period} of {plan} · {price} · bought {date}", {
                    period: monthsLabel(g.months),
                    plan: planById.get(g.planId)?.name ?? g.planId,
                    price: formatMoney(g.amountCents, g.currency),
                    date: endDate(g.createdAt),
                  })}
                  {!g.redeemedAt && giftNotStarted(g.startsOn) && t(" · starts {date}", { date: endDate(g.startsOn!) })}
                </p>
                {g.books.length > 0 && (
                  <p className="gift-meta">
                    {t("With {books}", { books: g.books.map((b) => getBook(b)?.title ?? b).join(", ") })}
                  </p>
                )}
                {!g.redeemedAt && (g.deliveredAt || g.recipientEmail) && (
                  <p className="gift-meta">
                    {g.deliveredAt
                      ? t("Emailed to them {date}", { date: endDate(g.deliveredAt) })
                      : g.startsOn && giftNotStarted(g.startsOn)
                        ? t("We'll email it to {email} on {date}", { email: g.recipientEmail ?? "", date: endDate(g.startsOn) })
                        : t("We'll email it to {email} within the hour", { email: g.recipientEmail ?? "" })}
                  </p>
                )}
              </div>
              <span className={`status-pill ${g.redeemedAt ? "status-paused" : "status-active"}`}>
                {g.redeemedAt ? t("Redeemed {date}", { date: endDate(g.redeemedAt) }) : t("Not redeemed yet")}
              </span>
              {!g.redeemedAt && (
                <button type="button" className="secondary-button" onClick={() => void copy(g.code)}>
                  {copied === g.code ? t("Copied") : t("Copy code")}
                  <span className="visually-hidden"> {formatGiftCode(g.code)}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="visually-hidden">
        {copied ? t("Copied {code}", { code: formatGiftCode(copied) }) : ""}
      </p>
    </section>
  );
}
