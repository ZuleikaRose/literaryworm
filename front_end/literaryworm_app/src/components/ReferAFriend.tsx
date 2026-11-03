import { useEffect, useId, useState } from "react";
import { monthsLeftToEarn, REFERRAL_MONTHS_MAX, referralLink } from "../lib/referrals";
import { loadReferrals, type ReferralStatus } from "../lib/referralsApi";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * Account → Plan and billing: the member's invitation link, Copy and Share, and how it's gone. A
 * friend who joins with it gets a month of their plan free after their first payment, and so does
 * the member, up to 2 months in all (lib/referrals.ts). Members only; staff are never billed.
 */
/** The demo household's sample: its own link, two friends signed up, one of them paid. */
const DEMO_STATUS: ReferralStatus = { code: "AVERY234", signedUp: 2, joined: 1, monthsEarned: 1, invited: null };

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
    const text = t("Join me on LiteraryWorm: ebooks and audiobooks in one place. After your first payment, your first month is on me.");
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

  const left = status ? monthsLeftToEarn(status.monthsEarned) : REFERRAL_MONTHS_MAX;
  return (
    <section className="refer-friend" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("Invite a friend")}</h3>
      <p className="field-hint">
        {t("When a friend joins with your link and makes their first payment, you each get a month of your own plan free, taken off your next bill. You can earn up to {max} free months this way.", { max: REFERRAL_MONTHS_MAX })}
      </p>
      {status?.invited && (
        <p className="form-success">
          <Icon name="check" size={16} />
          {status.invited.rewarded
            ? t("You joined with a friend's invitation, and your free month is on your account.")
            : t("You joined with a friend's invitation: your free month is added after your first payment.")}
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
            {" · "}
            {left === 0
              ? t("you've earned your {max} free months", { max: REFERRAL_MONTHS_MAX })
              : t.plural(status.monthsEarned, { one: "{count} free month earned, {left} to go", other: "{count} free months earned, {left} to go" }, { left })}
          </p>
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
