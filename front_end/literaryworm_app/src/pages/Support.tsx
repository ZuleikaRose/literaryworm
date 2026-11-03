import { type FormEvent, type RefObject, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { dateLocale, type T } from "../lib/i18n";
import { hoursAndMinutes } from "../lib/planLimits";
import { hasRole } from "../lib/staff";
import { lookupMember, type MemberLookup } from "../lib/staffApi";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const day = (t: T, iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(t.lang === "en" ? "en-GB" : dateLocale(t.lang), { day: "numeric", month: "long", year: "numeric" }) : "—";

/**
 * /support, for customer service staff and admins: look up one member by email to help with a
 * question (plan and billing, profiles, this month's listening, offline devices). Read only;
 * the database checks the role and records each lookup (support_member_lookup()).
 */
export default function Support() {
  const t = useT();
  useTitle(t("Member lookup"));
  const roles = useStaffRoles();
  const isDemo = useStore().state.account?.isDemo ?? false;
  const allowed = hasRole(roles, "customer_service");

  return (
    <div className="page dashboard-page">
      <BackLink />
      <h1>{t("Member lookup")}</h1>
      {allowed ? (
        <Lookup />
      ) : (
        <p className="account-sub">
          {isDemo
            ? t("The demo household has no staff access.")
            : t("Member lookup is for customer service staff and admins. An admin can give you access in Account → Team access.")}
        </p>
      )}
    </div>
  );
}

function Lookup() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; member: MemberLookup | null } | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes("@")) {
      setError(t("Enter the member's email address."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const member = await lookupMember(email);
      setResult({ email: email.trim(), member });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't look that up. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="account-sub">
        {t("Look up a member by email to answer a question about their plan, listening or devices. You see what support needs, never their library, reading or payment details, and every lookup is recorded.")}
      </p>
      <form className="support-form" noValidate onSubmit={submit}>
        <Field
          label={t("Member's email")}
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          error={error}
        />
        <button type="submit" className="primary-button" disabled={busy}>
          <Icon name="search" size={16} /> {busy ? t("Looking…") : t("Look up")}
        </button>
      </form>

      {result &&
        (result.member ? (
          <MemberCard member={result.member} headingRef={resultRef} />
        ) : (
          <h2 className="support-none" ref={resultRef} tabIndex={-1}>
            {t("No account uses {email}.", { email: result.email })}
          </h2>
        ))}
    </>
  );
}

function MemberCard({ member: m, headingRef }: { member: MemberLookup; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = useT();
  const listened = m.listeningMinutes * 60;
  const plan = m.complimentary
    ? t("{plan} · complimentary (staff)", { plan: m.planName ?? "Premium" })
    : m.planName
      ? `${m.planName} · ${m.status === "past_due" ? t("payment failed") : (m.status ?? "")}`
      : t("No plan chosen");
  return (
    <section className="support-card" aria-labelledby="support-member">
      <h2 id="support-member" ref={headingRef} tabIndex={-1}>
        {m.name ?? m.email}
      </h2>
      <dl className="account-facts">
        <div>
          <dt>{t("Email")}</dt>
          <dd>
            {m.email} · {m.emailConfirmed ? t("confirmed") : t("not confirmed yet")}
            {m.twoStep ? t(" · two-step sign-in on") : ""}
          </dd>
        </div>
        <div>
          <dt>{t("Member since")}</dt>
          <dd>{day(t, m.joinedAt)}</dd>
        </div>
        <div>
          <dt>{t("Plan")}</dt>
          <dd>{plan}</dd>
        </div>
        {m.planName && !m.complimentary && (
          <div>
            <dt>{t("Billing")}</dt>
            <dd>
              {m.cancelAt
                ? t("Cancelled: ends {date}", { date: day(t, m.cancelAt) })
                : m.giftUntil
                  ? t("A gift until {date}", { date: day(t, m.giftUntil) })
                  : m.billingInterval === "year"
                    ? t("Yearly: renews {date}", { date: day(t, m.nextBillingAt) })
                    : t("Monthly: next charge {date} (billing day {billingDay})", { date: day(t, m.nextBillingAt), billingDay: m.billingDay ?? "—" })}
              {" · "}
              {m.cardOnFile ? t("card on file") : t("no card on file")}
            </dd>
          </div>
        )}
        <div>
          <dt>{t("Profiles")}</dt>
          <dd>
            {t("{n} of {max}", { n: m.profiles, max: m.maxProfiles })}
            {m.kidsProfiles > 0 ? t(" ({n} Kids)", { n: m.kidsProfiles }) : ""}
          </dd>
        </div>
        <div>
          <dt>{t("Listening this month")}</dt>
          <dd>
            {m.audioHours === null
              ? t("{time} (unlimited)", { time: hoursAndMinutes(listened) })
              : listened >= m.audioHours * 3600
                ? t("{time} of {hours} hours: used up, so audiobooks are paused until the 1st", { time: hoursAndMinutes(Math.min(listened, m.audioHours * 3600)), hours: m.audioHours })
                : t("{time} of {hours} hours", { time: hoursAndMinutes(Math.min(listened, m.audioHours * 3600)), hours: m.audioHours })}
          </dd>
        </div>
        <div>
          <dt>{t("Offline devices")}</dt>
          <dd>
            {t("{n} of {max} in use", { n: m.offlineDevices.length, max: m.downloadDevices })}
            {m.offlineDevices.length > 0 && `: ${m.offlineDevices.map((d) => t("{device} (last used {date})", { device: d.label, date: day(t, d.lastSeenAt) })).join(", ")}`}
          </dd>
        </div>
        <div>
          <dt>{t("Open today")}</dt>
          <dd>{t.plural(m.devicesOpenToday, { one: "{count} device", other: "{count} devices" })}</dd>
        </div>
      </dl>
      <p className="field-hint">
        {t("The member frees offline devices themselves in Account → Plan and billing. Listening starts again on the 1st, or straight away on a bigger plan.")}
      </p>
    </section>
  );
}
