import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { statusLabel } from "../lib/affiliates";
import { type Application, loadApplications, reviewAffiliate } from "../lib/affiliatesApi";
import { dateLocale } from "../lib/i18n";
import { hasRole } from "../lib/staff";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";

/**
 * /affiliates/review (staff, lazy-loaded, linked from Team access and /affiliates): sales staff and
 * admins approve, decline or suspend affiliate applications. The database checks the role
 * (affiliate_applications(), review_affiliate()) and returns display names, never email addresses.
 */
export default function AffiliateReview() {
  const t = useT();
  useTitle(t("Affiliate applications"));
  const roles = useStaffRoles();
  const allowed = hasRole(roles, "sales");
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    loadApplications().then(setApps, (err: Error) => setError(err.message));
  }, []);
  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const decide = async (accountId: string, decision: "approved" | "declined" | "suspended") => {
    setBusy(accountId);
    setError(null);
    try {
      await reviewAffiliate(accountId, decision);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!allowed) {
    return (
      <article className="page">
        <h1>{t("Affiliate applications")}</h1>
        <p className="legal-summary">{t("Only sales staff and admins review affiliate applications.")}</p>
        <Link to="/affiliates">{t("About the affiliate program")}</Link>
      </article>
    );
  }

  const when = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
  return (
    <article className="page">
      <h1>{t("Affiliate applications")}</h1>
      <p className="legal-summary">
        {t("Approve sites that fit LiteraryWorm and say they'll disclose the commission. Decline anything aimed at children.")}
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {apps === null && !error && <p className="goal-hint">{t("Loading…")}</p>}
      {apps?.length === 0 && <p className="goal-hint">{t("No applications yet.")}</p>}
      {apps && apps.length > 0 && (
        <ul className="affiliate-review-list">
          {apps.map((a) => (
            <li key={a.accountId}>
              <p>
                <strong>{a.displayName ?? t("A member")}</strong> · {t(statusLabel[a.status])} · {t("applied {date}", { date: when(a.appliedAt) })}
              </p>
              <p>
                <a href={a.website} target="_blank" rel="noopener noreferrer nofollow">
                  {a.website}
                  <span className="visually-hidden"> {t("(opens in a new tab)")}</span>
                </a>
              </p>
              <p className="goal-hint">{a.channels}</p>
              <p className="goal-actions">
                {a.status !== "approved" && (
                  <button type="button" className="primary-button small-button" disabled={busy === a.accountId} onClick={() => void decide(a.accountId, "approved")}>
                    {t("Approve")}
                  </button>
                )}
                {a.status === "pending" && (
                  <button type="button" className="secondary-button small-button" disabled={busy === a.accountId} onClick={() => void decide(a.accountId, "declined")}>
                    {t("Decline")}
                  </button>
                )}
                {a.status === "approved" && (
                  <button type="button" className="secondary-button small-button" disabled={busy === a.accountId} onClick={() => void decide(a.accountId, "suspended")}>
                    {t("Suspend")}
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
