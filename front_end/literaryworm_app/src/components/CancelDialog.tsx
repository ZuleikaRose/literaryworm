import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice, perPeriod, planById, priceFor } from "../data/plans";
import { type CancelAnswer, saveOfferCredit } from "../lib/accountApi";
import { formatMoney } from "../lib/billing";
import { CANCEL_COMMENT_MAX, CANCEL_REASON_LABEL, CANCEL_REASONS, type CancelReason, cancelAnswerError, planBelow, saveOfferFor, type SaveOffer } from "../lib/cancelSurvey";
import { planCheckoutPath } from "../lib/planLimits";
import { useAccount } from "../lib/useAccount";
import { useT } from "../lib/useT";
import type { Account } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

interface Props {
  account: Account;
  /** What cancelling now would do: the dates, the 48-hour rule and no refunds. */
  confirmText: string;
  onClose: () => void;
  /** Cancels, with the member's answer when they gave one. */
  onCancel: (answer: CancelAnswer | null) => void;
  /** Pauses instead (monthly billing only). */
  onPause: () => void;
  /** The member took the month's credit and stays. */
  onKept: (message: string) => void;
}

type Step = "ask" | "offer";

/** The demo's sample credit: a month of its plan. */
const demoCredit = (planId: Account["planId"]) => (planId ? Math.round((planById.get(planId)?.price ?? 0) * 100) || null : null);

/**
 * Account's cancel dialog: asks why (optional), offers the one thing that fits the reason
 * (lib/cancelSurvey.ts), and cancels when the member still wants to. The answer goes with the
 * cancel, or is noted when another offer keeps them; the demo keeps nothing and credits nothing.
 * Render it only while it's open.
 */
export function CancelDialog({ account, confirmText, onClose, onCancel, onPause, onKept }: Props) {
  const t = useT();
  const id = useId();
  const { takeSaveOffer, keptByOffer } = useAccount();
  const [step, setStep] = useState<Step>("ask");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState("");
  const [credit, setCredit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  // Whether the month's credit is still on offer: asked once, when the dialog opens (the parent
  // mounts it only while open, so every opening starts afresh). The demo shows a month of its plan.
  useEffect(() => {
    let live = true;
    const ask = account.userId ? saveOfferCredit() : Promise.resolve(demoCredit(account.planId));
    ask.then(
      (cents) => live && setCredit(cents),
      () => live && setCredit(null),
    );
    return () => {
      live = false;
    };
  }, [account.userId, account.planId]);

  const plan = account.planId ? planById.get(account.planId) : undefined;
  if (!plan) return null;
  const interval = account.billingInterval;
  const offer: SaveOffer | null = saveOfferFor(reason, { planId: plan.id, interval, creditAvailable: credit !== null });
  const answer = (offered: SaveOffer | null): CancelAnswer | null => (reason ? { reason, comment, offer: offered } : null);
  const answerError = cancelAnswerError(reason, comment);
  const below = planBelow(plan.id);
  const smaller = below ? planById.get(below) : undefined;

  const next = (e: FormEvent) => {
    e.preventDefault();
    setShown(true);
    if (answerError) return;
    setStep("offer");
  };

  const takeOther = (offered: SaveOffer) => {
    const a = answer(offered);
    if (a) keptByOffer(a);
  };

  const takeCredit = async () => {
    const a = answer("credit");
    if (!a) return;
    setBusy(true);
    setError(null);
    try {
      const cents = await takeSaveOffer(a);
      onKept(
        account.isDemo
          ? t("In the demo nothing is credited. A member would get {amount} off their next charge.", { amount: formatMoney(cents, "usd") })
          : t("Thank you for staying. {amount} is now on your account and comes off your next charge.", { amount: formatMoney(cents, "usd") }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't add your credit. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const offerCard = (title: string, text: string, action: ReactNode) => (
    <div className="cancel-offer">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={step === "ask" ? t("Before you go") : t("Cancel your membership?")}
      description={
        step === "ask" ? <p>{t("Tell us why you're leaving, if you like. It helps us make LiteraryWorm better, and we may have something that helps.")}</p> : undefined
      }
    >
      {step === "ask" ? (
        <form onSubmit={next} noValidate>
          <fieldset className="cancel-reasons">
            <legend>{t("Why are you cancelling? (optional)")}</legend>
            {CANCEL_REASONS.map((r) => (
              <label key={r} className="check-row">
                <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} />
                <span>{t(CANCEL_REASON_LABEL[r])}</span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-comment`}>
              {t("Anything else? (optional)")}
            </label>
            <textarea
              id={`${id}-comment`}
              className="field-input"
              rows={3}
              maxLength={CANCEL_COMMENT_MAX}
              value={comment}
              aria-invalid={shown && answerError ? true : undefined}
              aria-describedby={`${id}-comment-hint${shown && answerError ? ` ${id}-comment-error` : ""}`}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="field-hint" id={`${id}-comment-hint`}>
              {t("Up to {max} characters. Only our billing team sees how many people give each reason; your note is kept for a year.", { max: CANCEL_COMMENT_MAX })}
            </p>
            {shown && answerError && (
              <p className="field-error" id={`${id}-comment-error`}>
                <Icon name="alert" size={15} />
                {t(answerError, { max: CANCEL_COMMENT_MAX })}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button type="submit" className="primary-button">
              {t("Continue")}
            </button>
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("Keep membership")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {offer === "pause" &&
            offerCard(
              t("Pause instead"),
              t("Nothing is charged until you resume, and your library, profiles and progress stay as they are."),
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  takeOther("pause");
                  onPause();
                }}
              >
                {t("Pause my membership")}
              </button>,
            )}
          {offer === "downgrade" &&
            smaller &&
            offerCard(
              t("Try {plan} instead", { plan: smaller.name }),
              t("{plan} is {price} {period}. Your library and progress come with you.", {
                plan: smaller.name,
                price: formatPrice(priceFor(smaller, interval)),
                period: perPeriod(interval),
              }),
              <Link className="primary-button" to={planCheckoutPath(smaller)} onClick={() => takeOther("downgrade")}>
                {t("See {plan}", { plan: smaller.name })}
              </Link>,
            )}
          {offer === "credit" &&
            credit !== null &&
            offerCard(
              t("Stay, and have a month on us"),
              t("We'll add {amount} to your account, taken off your next charge. This offer is once per account.", { amount: formatMoney(credit, "usd") }),
              <button type="button" className="primary-button" disabled={busy} onClick={takeCredit}>
                {t("Take the credit and stay")}
              </button>,
            )}
          {offer === "upload" &&
            offerCard(
              t("Read your own books here"),
              t("Upload DRM-free books you own and read or listen to them with everything else, natural voices included."),
              <Link className="primary-button" to="/library?view=uploads" onClick={() => takeOther("upload")}>
                {t("Go to my uploads")}
              </Link>,
            )}
          {offer === "help" &&
            offerCard(
              t("Let us help"),
              t("Many problems have a quick fix in the Help Center, and you can report one from there."),
              <Link className="primary-button" to="/legal/help" onClick={() => takeOther("help")}>
                {t("Open the Help Center")}
              </Link>,
            )}
          {error && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={15} />
              {error}
            </p>
          )}
          <p className="cancel-confirm">{confirmText}</p>
          <div className="modal-actions">
            <button type="button" className="danger-button" disabled={busy} onClick={() => onCancel(answer(offer))}>
              {offer ? t("Cancel anyway") : t("Cancel membership")}
            </button>
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("Keep membership")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
