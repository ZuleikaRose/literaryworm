import { cleanReferralCode } from "../lib/referrals";
import { cleanAffiliateCode } from "../lib/affiliates";
import { recordAffiliateClick } from "../lib/affiliatesApi";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HOME_CRUMB, pageData } from "../lib/seo";
import { StructuredData } from "../components/StructuredData";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { ResendConfirmation } from "../components/ResendConfirmation";
import { planById } from "../data/plans";
import { AccountError, signUp } from "../lib/accountApi";
import { usesBackend } from "../lib/backend";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { PASSWORD_MAX, PASSWORD_MIN, validateDob, validateEmail, validateNewPassword } from "../lib/validation";
import { useStore } from "../store/context";
import { emailKey, makeProfile } from "../store/state";
import type { PlanId } from "../types";

type FieldName = "name" | "email" | "password" | "dob" | "terms";
type Errors = Partial<Record<FieldName, string>>;

const today = new Date().toISOString().slice(0, 10);

export default function SignUp() {
  const t = useT();
  useTitle(t("Create your account"));
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planParam = params.get("plan") as PlanId | null;
  const plan = planParam ? planById.get(planParam) : undefined;
  const referralCode = cleanReferralCode(params.get("ref"));
  const affiliateCode = cleanAffiliateCode(params.get("aff"));
  // A visit through an affiliate's link is counted once (the affiliate-click function allows one a day per visitor).
  useEffect(() => {
    if (affiliateCode) recordAffiliateClick(affiliateCode);
  }, [affiliateCode]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const setupUrl = `/plans?setup=1${plan ? `&plan=${plan.id}` : ""}`;
  // Also catches the render right after "Create account", so it must agree with submit() on where to go.
  if (state.account) return <Navigate to={state.account.planId ? "/profiles" : setupUrl} replace />;

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = t("Enter your name.");
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    // Real accounts: Supabase answers the same way for new and existing emails, so nothing is revealed here.
    else if (!usesBackend && state.households[emailKey(email)]) next.email = t("An account already uses this email. Log in instead.");
    const passwordError = validateNewPassword(password);
    if (passwordError) next.password = passwordError;
    const dobError = validateDob(dob);
    if (dobError) next.dob = dobError;
    if (!terms) next.terms = t("Accept the Terms of Service to create an account.");
    return next;
  };

  // After the first submit, errors update as people fix them.
  const liveErrors = submitted ? validate() : errors;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Move focus to the first field that needs attention.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (usesBackend) {
      setBusy(true);
      setFormError(null);
      try {
        const { needsConfirmation } = await signUp({ name, email, password, dob, marketingEmails: marketing, referralCode, affiliateCode });
        // Confirmed straight away: useAuthSync loads the account and the redirect above continues to the plan step.
        if (needsConfirmation) setSentTo(email.trim());
      } catch (err) {
        setFormError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      } finally {
        setBusy(false);
      }
      return;
    }
    const firstName = name.trim().split(/\s+/)[0];
    dispatch({
      type: "createAccount",
      account: {
        name: name.trim(),
        email: email.trim(),
        password,
        dob,
        planId: null,
        billingDay: null,
        billingInterval: "month",
        renewsAt: null,
        marketingEmails: marketing,
        releaseEmails: true,
        authorEmails: true,
        updateEmails: false,
        kidsReportEmails: false,
        clubMeetingEmails: true,
        clubPostEmails: false,
        isDemo: false,
        status: "active",
        endsAt: null,
        complimentary: false,
        stripeLinked: false,
        pastDue: false,
        giftUntil: null,
        switchToMonthly: null,
        memberSince: null,
      },
      firstProfile: makeProfile({ name: firstName, ageRating: "all" }),
    });
    navigate(setupUrl);
  };

  const length = password.length;

  if (sentTo) {
    return (
      <AuthCard
        eyebrow={t("Check your email")}
        title={t("Confirm your email address")}
        intro={
          <p>
            {rich(t("We've sent a link to {email}. Open it to confirm your address, then log in to choose your plan. The link works for 1 hour."), {
              email: <strong>{sentTo}</strong>,
            })}
          </p>
        }
        footer={
          <>
            <span>{t("Confirmed already?")}</span>
            <Link to="/signin">{t("Log in")}</Link>
          </>
        }
      >
        <p className="auth-note">
          {t("No email after a few minutes? Check your spam folder. If you already have an account with this email, log in or reset your password instead.")}
        </p>
        <ResendConfirmation email={sentTo} />
      </AuthCard>
    );
  }

  return (
    <>
      <StructuredData
        id="page"
        data={pageData({ path: "/signup", name: "Create your account", crumbs: [HOME_CRUMB, { name: "Create your account", path: "/signup" }] })}
      />
      <AuthCard
        eyebrow={t("Join LiteraryWorm")}
        title={t("Create your account")}
        intro={
          <p>
            {t("Account holders must be 18 or older. You'll add profiles for everyone else at home next.")}
            {plan && (
              <>
                {" "}
                {rich(t("You picked {plan}; you'll confirm it before paying anything."), { plan: <strong>{plan.name}</strong> })}
              </>
            )}
            {referralCode && (
              <>
                {" "}
                <strong>{t("A friend invited you: after your first payment, a month of your plan is free.")}</strong>
              </>
            )}
            {affiliateCode && (
              <>
                {" "}
                {t("You came through a LiteraryWorm affiliate's link: they'll see that someone signed up, never who.")}
              </>
            )}
          </p>
        }
        footer={
          <>
            <span>{t("Already have an account?")}</span>
            <Link to="/signin">{t("Log in")}</Link>
          </>
        }
      >
        {formError && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{formError}</p>
          </div>
        )}
        <form ref={formRef} className="auth-form" noValidate onSubmit={submit}>
          <Field
            label={t("Your name")}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={liveErrors.name}
          />
          <Field
            label={t("Email address")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("you@example.com")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={liveErrors.email}
          />
          <PasswordField
            label={t("Password")}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={liveErrors.password}
            hint={
              <>
                {t("{min} to {max} characters. No need for symbols or numbers; a short phrase is strong.", { min: PASSWORD_MIN, max: PASSWORD_MAX })}{" "}
                <span className={length >= PASSWORD_MIN ? "hint-ok" : undefined} aria-live="polite">
                  {length >= PASSWORD_MIN ? (
                    <>
                      <Icon name="check" size={13} /> {t("Long enough")}
                    </>
                  ) : (
                    `${length}/${PASSWORD_MIN}`
                  )}
                </span>
              </>
            }
          />
          <Field
            label={t("Date of birth")}
            type="date"
            autoComplete="bday"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            error={liveErrors.dob}
            hint={t("We use this only to confirm you're 18 or older.")}
          />

          <div className="auth-checks">
            <label className="check-row">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                aria-invalid={liveErrors.terms ? true : undefined}
                aria-describedby={liveErrors.terms ? "terms-error" : undefined}
              />
              <span>
                {rich(t("I accept the {terms} and have read the {privacy}."), {
                  terms: <Link to="/legal/terms">{t("Terms of Service")}</Link>,
                  privacy: <Link to="/legal/privacy">{t("Privacy Policy")}</Link>,
                })}
              </span>
            </label>
            {liveErrors.terms && (
              <p className="field-error" id="terms-error">
                <Icon name="alert" size={15} />
                {liveErrors.terms}
              </p>
            )}
            <label className="check-row">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>{t("Email me about new releases and offers. You can change this any time.")}</span>
            </label>
          </div>

          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy ? t("Creating your account…") : t("Create account")}
          </button>
        </form>
      </AuthCard>
    </>
  );
}
