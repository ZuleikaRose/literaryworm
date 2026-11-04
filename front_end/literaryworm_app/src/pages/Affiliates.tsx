import { type FormEvent, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { StructuredData } from "../components/StructuredData";
import { formatPrice } from "../data/plans";
import { affiliateLink, type Application, applicationErrors, CHANNELS_MAX, statusLabel } from "../lib/affiliates";
import { applyAffiliate, DEMO_AFFILIATE, loadMyAffiliate, type MyAffiliate } from "../lib/affiliatesApi";
import { HOME_CRUMB, pageData } from "../lib/seo";
import { hasRole } from "../lib/staff";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const DESCRIPTION = "Recommend LiteraryWorm and earn 20% of each referred member's first payment as credit on your own membership.";

/**
 * /affiliates (public): the affiliate program (stories 82–84). Members apply here and, once
 * approved, see their link and how it's doing (counts only). The demo shows a sample. Staff can't
 * be affiliates (they're never billed); sales staff and admins review at /affiliates/review.
 */
export default function Affiliates() {
  const t = useT();
  useTitle(t("Affiliate program"), DESCRIPTION);
  const { state } = useStore();
  const account = state.account;
  const roles = useStaffRoles();
  const member = Boolean(account?.userId) && !account?.isDemo;

  return (
    <article className="page affiliates-page">
      <StructuredData
        id="page"
        data={pageData({
          path: "/affiliates",
          name: "Affiliate program",
          description: DESCRIPTION,
          crumbs: [HOME_CRUMB, { name: "Affiliate program", path: "/affiliates" }],
        })}
      />
      <p className="eyebrow">{t("Affiliate program")}</p>
      <h1>{t("Recommend LiteraryWorm, earn account credit")}</h1>
      <p className="legal-summary">
        {t("When someone signs up with your link and makes their first payment, 20% of that payment is added to your own LiteraryWorm membership as credit, taken off your next bills. There are no cash payouts.")}
      </p>

      <section className="affiliate-rules" aria-labelledby="affiliate-how">
        <h2 id="affiliate-how">{t("How it works")}</h2>
        <ol className="affiliate-steps">
          <li>{t("Apply with your website or channel and how you'll share LiteraryWorm.")}</li>
          <li>{t("Our team reviews each application. Once you're approved, you get your own sign-up link.")}</li>
          <li>{t("Share it. You'll see visits to your link, sign-ups, first payments and the credit you've earned, never who signed up.")}</li>
        </ol>
        <h2>{t("The rules")}</h2>
        <ul className="affiliate-terms">
          <li>{t("You need a LiteraryWorm membership to earn credit; account holders are 18 or older.")}</li>
          <li>{t("Say that you earn a commission wherever you share your link, as the FTC's Endorsement Guides require.")}</li>
          <li>{t("Never market LiteraryWorm to children, or on pages, channels or apps made for them.")}</li>
          <li>{t("Credit is earned once per member, on their first payment, and can't be exchanged for cash.")}</li>
          <li>
            {t("We may decline an application, or suspend an affiliate who breaks these rules.")}{" "}
            <Link to="/legal/terms">{t("Read the Terms of Service")}</Link>
          </li>
        </ul>
      </section>

      {!account && (
        <section className="goal-card affiliate-panel">
          <h2>{t("Apply")}</h2>
          <p>{t("Log in, or join, to apply.")}</p>
          <p className="goal-actions">
            <Link className="primary-button" to="/signin">
              {t("Log in")}
            </Link>
            <Link className="secondary-button" to="/plans">
              {t("See plans and join")}
            </Link>
          </p>
        </section>
      )}
      {account?.isDemo && <AffiliateDashboard affiliate={DEMO_AFFILIATE} demo />}
      {member && roles.length > 0 && (
        <section className="goal-card affiliate-panel">
          <p>{t("Staff memberships aren't billed, so staff can't be affiliates.")}</p>
          {hasRole(roles, "sales") && (
            <Link className="secondary-button" to="/affiliates/review">
              {t("Review applications")}
            </Link>
          )}
        </section>
      )}
      {member && roles.length === 0 && <MemberAffiliate />}
    </article>
  );
}

function MemberAffiliate() {
  const t = useT();
  const [mine, setMine] = useState<MyAffiliate | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [applyAgain, setApplyAgain] = useState(false);

  useEffect(() => {
    let live = true;
    loadMyAffiliate().then(
      (a) => live && setMine(a),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <p className="field-error" role="alert">
        <Icon name="alert" size={15} /> {error}
      </p>
    );
  }
  if (mine === undefined) return <p className="goal-hint">{t("Loading…")}</p>;
  if (mine === null || (mine.status === "declined" && applyAgain)) {
    return <ApplicationForm onApplied={() => loadMyAffiliate().then(setMine, (err: Error) => setError(err.message))} />;
  }
  if (mine.status === "approved" || mine.status === "suspended") return <AffiliateDashboard affiliate={mine} />;
  return (
    <section className="goal-card affiliate-panel" aria-live="polite">
      <h2>{t("Your application")}</h2>
      <p>
        <strong>{t(statusLabel[mine.status])}</strong>
        {" · "}
        {mine.website}
      </p>
      {mine.status === "pending" ? (
        <p className="goal-hint">{t("We'll show your link here once your application is approved.")}</p>
      ) : (
        <>
          <p className="goal-hint">{t("Your application wasn't approved this time. You can change it and apply again.")}</p>
          <button type="button" className="secondary-button" onClick={() => setApplyAgain(true)}>
            {t("Apply again")}
          </button>
        </>
      )}
    </section>
  );
}

function ApplicationForm({ onApplied }: { onApplied: () => void }) {
  const t = useT();
  const id = useId();
  const [form, setForm] = useState<Application>({ website: "", channels: "", acceptsTerms: false, disclosesCommission: false, noMarketingToChildren: false });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = applicationErrors(form);
  const shown = tried ? errors : {};
  const set = (patch: Partial<Application>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      await applyAffiliate(form.website, form.channels);
      onApplied();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const check = (key: "acceptsTerms" | "disclosesCommission" | "noMarketingToChildren", label: string) => (
    <div className="field">
      <label className="check-row">
        <input
          type="checkbox"
          checked={form[key]}
          onChange={(e) => set({ [key]: e.target.checked })}
          aria-invalid={shown[key] ? true : undefined}
          aria-describedby={shown[key] ? `${id}-${key}` : undefined}
        />
        <span>{label}</span>
      </label>
      {shown[key] && (
        <p className="field-error" id={`${id}-${key}`}>
          <Icon name="alert" size={15} />
          {t(shown[key]!)}
        </p>
      )}
    </div>
  );

  return (
    <form className="goal-card affiliate-panel" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Apply")}</h2>
      <Field
        label={t("Your website or channel")}
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://"
        value={form.website}
        onChange={(e) => set({ website: e.target.value })}
        error={shown.website ? t(shown.website) : null}
      />
      <div className="field">
        <label className="field-label" htmlFor={`${id}-channels`}>
          {t("How you'll share LiteraryWorm")}
        </label>
        <textarea
          id={`${id}-channels`}
          className="field-input"
          rows={3}
          maxLength={CHANNELS_MAX}
          value={form.channels}
          onChange={(e) => set({ channels: e.target.value })}
          aria-invalid={shown.channels ? true : undefined}
          aria-describedby={shown.channels ? `${id}-channels-error` : undefined}
        />
        {shown.channels && (
          <p className="field-error" id={`${id}-channels-error`}>
            <Icon name="alert" size={15} />
            {t(shown.channels)}
          </p>
        )}
      </div>
      {check("acceptsTerms", t("I agree to the affiliate program rules above and the Terms of Service."))}
      {check("disclosesCommission", t("I'll say that I earn a commission wherever I share my link."))}
      {check("noMarketingToChildren", t("I won't market LiteraryWorm to children."))}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? t("Sending…") : t("Send application")}
      </button>
    </form>
  );
}

function AffiliateDashboard({ affiliate, demo = false }: { affiliate: MyAffiliate; demo?: boolean }) {
  const t = useT();
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = affiliate.code ? affiliateLink(affiliate.code) : "";
  const s = affiliate.stats;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(t("We couldn't copy the link. Select it and copy it yourself."));
    }
  };

  return (
    <section className="goal-card affiliate-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Your affiliate link")}</h2>
      {demo && <p className="goal-hint">{t("In the demo the link and counts are a sample: affiliates see their own here.")}</p>}
      {affiliate.status === "suspended" ? (
        <p className="field-error">
          <Icon name="alert" size={15} /> {t("Your link is suspended: it no longer counts sign-ups or earns credit. Write to hello@literaryworm.com if you think that's a mistake.")}
        </p>
      ) : (
        <>
          <div className="refer-link">
            <label className="field-label" htmlFor={`${id}-link`}>
              {t("Your link")}
            </label>
            <input id={`${id}-link`} className="field-input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <p className="goal-actions">
            <button type="button" className="secondary-button small-button" onClick={() => void copy()}>
              {copied ? t("Copied") : t("Copy link")}
            </button>
          </p>
          <p className="field-hint">{t("Wherever you share it, say that you earn a commission.")}</p>
        </>
      )}
      {s && (
        <dl className="affiliate-stats">
          <div>
            <dt>{t("Visits in the last 30 days")}</dt>
            <dd>{s.clicks30Days}</dd>
          </div>
          <div>
            <dt>{t("Visits in all")}</dt>
            <dd>{s.clicksTotal}</dd>
          </div>
          <div>
            <dt>{t("Signed up")}</dt>
            <dd>{s.signedUp}</dd>
          </div>
          <div>
            <dt>{t("Made their first payment")}</dt>
            <dd>{s.paid}</dd>
          </div>
          <div>
            <dt>{t("Credit earned")}</dt>
            <dd>{formatPrice(s.earnedCents / 100)}</dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </section>
  );
}
