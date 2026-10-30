import { type FormEvent, type RefObject, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { hoursAndMinutes } from "../lib/planLimits";
import { hasRole } from "../lib/staff";
import { lookupMember, type MemberLookup } from "../lib/staffApi";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

/**
 * /support, for customer service staff and admins: look up one member by email to help with a
 * question (plan and billing, profiles, this month's listening, offline devices). Read only;
 * the database checks the role and records each lookup (support_member_lookup()).
 */
export default function Support() {
  useTitle("Member lookup");
  const roles = useStaffRoles();
  const isDemo = useStore().state.account?.isDemo ?? false;
  const allowed = hasRole(roles, "customer_service");

  return (
    <div className="page dashboard-page">
      <BackLink />
      <h1>Member lookup</h1>
      {allowed ? (
        <Lookup />
      ) : (
        <p className="account-sub">
          {isDemo
            ? "The demo household has no staff access."
            : "Member lookup is for customer service staff and admins. An admin can give you access in Account → Team access."}
        </p>
      )}
    </div>
  );
}

function Lookup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; member: MemberLookup | null } | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes("@")) {
      setError("Enter the member's email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const member = await lookupMember(email);
      setResult({ email: email.trim(), member });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't look that up. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="account-sub">
        Look up a member by email to answer a question about their plan, listening or devices. You see what support needs, never
        their library, reading or payment details, and every lookup is recorded.
      </p>
      <form className="support-form" noValidate onSubmit={submit}>
        <Field
          label="Member's email"
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
          <Icon name="search" size={16} /> {busy ? "Looking…" : "Look up"}
        </button>
      </form>

      {result &&
        (result.member ? (
          <MemberCard member={result.member} headingRef={resultRef} />
        ) : (
          <h2 className="support-none" ref={resultRef} tabIndex={-1}>
            No account uses {result.email}.
          </h2>
        ))}
    </>
  );
}

function MemberCard({ member: m, headingRef }: { member: MemberLookup; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const listened = m.listeningMinutes * 60;
  const plan = m.complimentary
    ? `${m.planName ?? "Premium"} · complimentary (staff)`
    : m.planName
      ? `${m.planName} · ${m.status === "past_due" ? "payment failed" : (m.status ?? "")}`
      : "No plan chosen";
  return (
    <section className="support-card" aria-labelledby="support-member">
      <h2 id="support-member" ref={headingRef} tabIndex={-1}>
        {m.name ?? m.email}
      </h2>
      <dl className="account-facts">
        <div>
          <dt>Email</dt>
          <dd>
            {m.email} · {m.emailConfirmed ? "confirmed" : "not confirmed yet"}
            {m.twoStep ? " · two-step sign-in on" : ""}
          </dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{day(m.joinedAt)}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{plan}</dd>
        </div>
        {m.planName && !m.complimentary && (
          <div>
            <dt>Billing</dt>
            <dd>
              {m.cancelAt
                ? `Cancelled: ends ${day(m.cancelAt)}`
                : m.giftUntil
                  ? `A gift until ${day(m.giftUntil)}`
                  : m.billingInterval === "year"
                    ? `Yearly: renews ${day(m.nextBillingAt)}`
                    : `Monthly: next charge ${day(m.nextBillingAt)} (billing day ${m.billingDay ?? "—"})`}
              {" · "}
              {m.cardOnFile ? "card on file" : "no card on file"}
            </dd>
          </div>
        )}
        <div>
          <dt>Profiles</dt>
          <dd>
            {m.profiles} of {m.maxProfiles}
            {m.kidsProfiles > 0 ? ` (${m.kidsProfiles} Kids)` : ""}
          </dd>
        </div>
        <div>
          <dt>Listening this month</dt>
          <dd>
            {m.audioHours === null
              ? `${hoursAndMinutes(listened)} (unlimited)`
              : `${hoursAndMinutes(Math.min(listened, m.audioHours * 3600))} of ${m.audioHours} hours${listened >= m.audioHours * 3600 ? ": used up, so audiobooks are paused until the 1st" : ""}`}
          </dd>
        </div>
        <div>
          <dt>Offline devices</dt>
          <dd>
            {m.offlineDevices.length} of {m.downloadDevices} in use
            {m.offlineDevices.length > 0 && `: ${m.offlineDevices.map((d) => `${d.label} (last used ${day(d.lastSeenAt)})`).join(", ")}`}
          </dd>
        </div>
        <div>
          <dt>Open today</dt>
          <dd>{m.devicesOpenToday === 1 ? "1 device" : `${m.devicesOpenToday} devices`}</dd>
        </div>
      </dl>
      <p className="field-hint">
        The member frees offline devices themselves in Account → Plan and billing. Listening starts again on the 1st, or straight away
        on a bigger plan.
      </p>
    </section>
  );
}
