import { useEffect, useId, useState } from "react";
import { formatMoney } from "../lib/billing";
import { inviterCredit, referralLink } from "../lib/referrals";
import { loadReferrals, type ReferralStatus } from "../lib/referralsApi";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * Account → Plan and billing: the member's invitation link, Copy and Share, and how it's gone. When a
 * friend joins with it and makes their first payment, each of them gets 20% off one month of their own
 * plan: the friend once, the member once per account (lib/referrals.ts). Free months earned before the
 * change stay and are shown. Members only; staff are never billed.
 */
/** The demo household's sample: its own link, two friends signed up, one of them paid (Standard, monthly: $8.00). */
const DEMO_CREDIT_CENTS = 800;
const DEMO_STATUS: ReferralStatus = {
  code: "AVERY234",
  signedUp: 2,
  joined: 1,
  monthsEarned: 0,
  creditCents: DEMO_CREDIT_CENTS,
  waiting: 1,
  hasPaidPlan: true,
  creditTakenBack: false,
  creditState: "added",
  invited: null,
};
/** Credits are in the plans' currency (public.plans.currency). */
const CURRENCY = "usd";

export function ReferAFriend({ demo = false }: { demo?: boolean }) {
  const t = useT();
  const id = useId();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (demo) {
      setStatus(DEMO_STATUS);
      return;
    }
    let live = true;
    loadReferrals().then(
      (s) => live && setStatus(s),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [demo]);

  const link = status ? referralLink(status.code) : "";
  const share = async () => {
    const text = t("Join me on LiteraryWorm: ebooks and audiobooks in one place. After your first payment, you get 20% off a month of your plan.");
    if (navigator.share) {
      try {
        await navigator.share({ title: "LiteraryWorm", text, url: link });
        return;
      } catch {
        // Closed the share sheet, or sharing isn't allowed here: copy instead.
      }
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(t("We couldn't copy the link. Select it and copy it yourself."));
    }
  };

  const credit = status ? inviterCredit(status.creditCents, status.waiting, status.hasPaidPlan, status.creditTakenBack) : "none";
  const invited = status?.invited ?? null;
  const invitedCredit = status?.invited?.creditCents ? formatMoney(status.invited.creditCents, CURRENCY) : null;
  return (
    <section className="refer-friend" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("Invite a friend")}</h3>
      <p className="field-hint">
        {t("When a friend joins with your link and makes their first payment, you each get 20% off one month of your own plan, taken off your next bill. You get yours once, and every friend you invite gets theirs. If that first payment is fully refunded or disputed, both credits are taken back; if a dispute is won, they're added again.")}
      </p>
      {invited && (
        <p className={invited.state === "added" ? "form-success" : "field-hint"}>
          {invited.state === "added" && <Icon name="check" size={16} />}
          {!invited.rewarded
            ? invited.rule === "free_month"
              ? t("You joined with a friend's invitation: your free month is added after your first payment.")
              : t("You joined with a friend's invitation: 20% off a month of your plan is added after your first payment.")
            : invited.state === "taken_back"
              ? t("You joined with a friend's invitation. Your 20% credit was taken back because your first payment was fully refunded or disputed.")
              : invited.state === "parked"
                ? t("You joined with a friend's invitation. Your credit is delayed: we're looking into it.")
                : !invitedCredit || !invited.state
                  ? t("You joined with a friend's invitation.")
                  : invited.rule === "free_month"
                    ? invited.state === "added"
                      ? t("You joined with a friend's invitation, and your free month is on your account.")
                      : t("You joined with a friend's invitation, and your free month is being added to your account.")
                    : invited.state === "added"
                      ? t("You joined with a friend's invitation, and your 20% credit of {amount} is on your account.", { amount: invitedCredit })
                      : t("You joined with a friend's invitation, and your 20% credit of {amount} is being added to your account.", { amount: invitedCredit })}
        </p>
      )}
      {demo && <p className="goal-hint">{t("In the demo the link and counts are a sample: members get their own link here.")}</p>}
      {status && (
        <>
          <div className="refer-link">
            <label className="field-label" htmlFor={`${id}-link`}>
              {t("Your link")}
            </label>
            <input id={`${id}-link`} className="field-input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <div className="goal-actions">
            <button type="button" className="primary-button small-button" onClick={() => void share()}>
              <Icon name="share" size={15} /> {t("Share")}
            </button>
            <button type="button" className="secondary-button small-button" onClick={() => void copy()}>
              {copied ? t("Copied") : t("Copy link")}
            </button>
          </div>
          <p className="field-hint" aria-live="polite">
            {t.plural(status.signedUp, { one: "{count} friend has signed up with your link", other: "{count} friends have signed up with your link" })}
          </p>
          <p className="field-hint">
            {credit === "earned"
              ? status.creditState === "parked"
                ? t("Your 20% credit is delayed: we're looking into it.")
                : status.creditState === "added"
                  ? t("Your 20% credit of {amount} is on your account.", { amount: formatMoney(status.creditCents ?? 0, CURRENCY) })
                  : t("Your 20% credit of {amount} is being added to your account.", { amount: formatMoney(status.creditCents ?? 0, CURRENCY) })
              : credit === "taken_back"
                ? t("Your 20% credit was taken back because your friend's first payment was fully refunded or disputed.")
                : credit === "pending"
                ? t("Your 20% credit is pending: it's added when a friend you invited makes their first payment.")
                : credit === "needs_plan"
                  ? t("A friend you invited hasn't paid yet. Your 20% credit is added when they do, as long as you have a paid plan then.")
                  : t("Not earned yet: your 20% credit is added when a friend joins with your link and makes their first payment while you have a paid plan.")}
          </p>
          {status.monthsEarned > 0 && (
            <p className="field-hint">
              {t.plural(status.monthsEarned, {
                one: "You also earned {count} free month from invitations before this changed, and it stays on your account.",
                other: "You also earned {count} free months from invitations before this changed, and they stay on your account.",
              })}
            </p>
          )}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}
