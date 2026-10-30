import { type FormEvent, useId, useState } from "react";
import { planById } from "../data/plans";
import { AccountError, loadAccount, planFields, redeemGift } from "../lib/accountApi";
import { endDate } from "../lib/billing";
import { giftCodeError, monthsLabel } from "../lib/gifts";
import { useStore } from "../store/context";
import type { Account } from "../types";
import { Icon } from "./Icon";

const message = (err: unknown) => (err instanceof AccountError ? err.message : "We couldn't redeem that gift. Try again.");

/**
 * Redeem a gift code (Account, Plans and Gifts). On a membership on the gift's plan, the next
 * charge moves back by the gift's months. Without one, the member first agrees to what happens
 * when the gift ends; Stripe then starts a membership free for the months and the webhook writes
 * it, so this waits for it before saying it's ready.
 */
export function RedeemGift({ account, onStarted, initialCode = "" }: { account: Account; onStarted?: () => void; initialCode?: string }) {
  const id = useId();
  const { dispatch } = useStore();
  // Filled in from a gift email's link (/gifts?code=…).
  const [code, setCode] = useState(initialCode);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "code" | "agree" | "form"; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // A membership that carries on: the gift just moves its next charge back.
  const hasMembership = Boolean(account.planId && account.stripeLinked && account.status !== "cancelled");

  async function waitForMembership(): Promise<boolean> {
    for (let tries = 0; tries < 15; tries++) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      try {
        const fresh = await loadAccount();
        if (fresh?.planId && fresh.stripeLinked && fresh.giftUntil) {
          dispatch({ type: "updateAccount", patch: planFields(fresh) });
          return true;
        }
      } catch {
        // Offline for a moment: keep looking.
      }
    }
    return false;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setDone(null);
    const problem = giftCodeError(code);
    if (problem) return setError({ field: "code", text: problem });
    if (!hasMembership && !agreed) return setError({ field: "agree", text: "Tick the box to agree to what happens when the gift ends." });
    setBusy(true);
    setError(null);
    try {
      const gift = await redeemGift(code, !hasMembership);
      const what = `${monthsLabel(gift.months)} of ${planById.get(gift.planId)?.name ?? gift.planId}`;
      setCode("");
      setAgreed(false);
      if (gift.plan) {
        dispatch({ type: "updateAccount", patch: gift.plan });
        setDone(`Gift redeemed: ${what}. Nothing is charged until ${endDate(gift.until)}.`);
        return;
      }
      setDone(`Gift redeemed: ${what}. Setting up your membership…`);
      const ready = await waitForMembership();
      setDone(
        ready
          ? `Gift redeemed: your ${what} start today and run until ${endDate(gift.until)}.`
          : `Gift redeemed: ${what}, until ${endDate(gift.until)}. Your membership is taking a little longer to appear: refresh the page in a minute.`,
      );
      if (ready) onStarted?.();
    } catch (err) {
      setError({ field: "form", text: message(err) });
    } finally {
      setBusy(false);
    }
  }

  const describedBy = error?.field === "code" ? `${id}-error` : `${id}-hint`;
  return (
    <section className="redeem-gift" id="redeem" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Redeem a gift</h3>
      <form className="redeem-form" onSubmit={submit} noValidate>
        <div className="promo-form">
          <div className="field">
            <label className="field-label" htmlFor={id}>
              Gift code
            </label>
            <input
              id={id}
              className="field-input gift-code-input"
              value={code}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
              placeholder="ABCD-EFGH-JKLM-NPQR"
              aria-invalid={error?.field === "code" ? true : undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                setCode(e.target.value);
                if (error?.field === "code") setError(null);
              }}
            />
            {error?.field === "code" ? (
              <p className="field-error" id={`${id}-error`}>
                <Icon name="alert" size={15} />
                {error.text}
              </p>
            ) : (
              <p className="field-hint" id={`${id}-hint`}>
                {hasMembership
                  ? "The gift must be for your plan. Its months are added before your next charge."
                  : "Your membership starts today, free for the gift's months. No card needed."}
              </p>
            )}
          </div>
          <button type="submit" className="secondary-button" disabled={busy}>
            Redeem gift
          </button>
        </div>
        {!hasMembership && (
          <>
            <label className="check-row">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked && error?.field === "agree") setError(null);
                }}
                aria-invalid={error?.field === "agree" || undefined}
                aria-describedby={error?.field === "agree" ? `${id}-agree-error` : undefined}
              />
              <span>
                I understand that when the gift ends, my membership ends too, unless I add a card in Account. With a card, it renews
                automatically each month at the plan's price until I cancel.
              </span>
            </label>
            {error?.field === "agree" && (
              <p className="field-error" id={`${id}-agree-error`}>
                <Icon name="alert" size={15} />
                {error.text}
              </p>
            )}
          </>
        )}
      </form>
      {error?.field === "form" && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} />
          {error.text}
        </p>
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
