import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { ResendConfirmation } from "../components/ResendConfirmation";
import { planById } from "../data/plans";
import { AccountError, signUp } from "../lib/accountApi";
import { usesBackend } from "../lib/backend";
import { useTitle } from "../lib/useTitle";
import { PASSWORD_MAX, PASSWORD_MIN, validateDob, validateEmail, validateNewPassword } from "../lib/validation";
import { useStore } from "../store/context";
import { emailKey, makeProfile } from "../store/state";
import type { PlanId } from "../types";

type FieldName = "name" | "email" | "password" | "dob" | "terms";
type Errors = Partial<Record<FieldName, string>>;

const today = new Date().toISOString().slice(0, 10);

export default function SignUp() {
  useTitle("Create your account");
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planParam = params.get("plan") as PlanId | null;
  const plan = planParam ? planById.get(planParam) : undefined;

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
    if (!name.trim()) next.name = "Enter your name.";
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    // Real accounts: Supabase answers the same way for new and existing emails, so nothing is revealed here.
    else if (!usesBackend && state.households[emailKey(email)]) next.email = "An account already uses this email. Log in instead.";
    const passwordError = validateNewPassword(password);
    if (passwordError) next.password = passwordError;
    const dobError = validateDob(dob);
    if (dobError) next.dob = dobError;
    if (!terms) next.terms = "Accept the Terms of Service to create an account.";
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
        const { needsConfirmation } = await signUp({ name, email, password, dob, marketingEmails: marketing });
        // Confirmed straight away: useAuthSync loads the account and the redirect above continues to the plan step.
        if (needsConfirmation) setSentTo(email.trim());
      } catch (err) {
        setFormError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
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
        marketingEmails: marketing,
        releaseEmails: true,
        authorEmails: true,
        updateEmails: false,
        isDemo: false,
        status: "active",
        endsAt: null,
        complimentary: false,
        stripeLinked: false,
        pastDue: false,
        giftUntil: null,
      },
      firstProfile: makeProfile({ name: firstName, ageRating: "all" }),
    });
    navigate(setupUrl);
  };

  const length = password.length;

  if (sentTo) {
    return (
      <AuthCard
        eyebrow="Check your email"
        title="Confirm your email address"
        intro={
          <p>
            We've sent a link to <strong>{sentTo}</strong>. Open it to confirm your address, then log in to choose your
            plan. The link works for 1 hour.
          </p>
        }
        footer={
          <>
            <span>Confirmed already?</span>
            <Link to="/signin">Log in</Link>
          </>
        }
      >
        <p className="auth-note">
          No email after a few minutes? Check your spam folder. If you already have an account with this email, log in
          or reset your password instead.
        </p>
        <ResendConfirmation email={sentTo} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Join LiteraryWorm"
      title="Create your account"
      intro={
        <p>
          Account holders must be 18 or older. You'll add profiles for everyone else at home next.
          {plan && (
            <>
              {" "}
              You picked <strong>{plan.name}</strong>; you'll confirm it before paying anything.
            </>
          )}
        </p>
      }
      footer={
        <>
          <span>Already have an account?</span>
          <Link to="/signin">Log in</Link>
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
          label="Your name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={liveErrors.name}
        />
        <Field
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={liveErrors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={liveErrors.password}
          hint={
            <>
              {PASSWORD_MIN} to {PASSWORD_MAX} characters. No need for symbols or numbers; a short phrase is strong.{" "}
              <span className={length >= PASSWORD_MIN ? "hint-ok" : undefined} aria-live="polite">
                {length >= PASSWORD_MIN ? (
                  <>
                    <Icon name="check" size={13} /> Long enough
                  </>
                ) : (
                  `${length}/${PASSWORD_MIN}`
                )}
              </span>
            </>
          }
        />
        <Field
          label="Date of birth"
          type="date"
          autoComplete="bday"
          max={today}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          error={liveErrors.dob}
          hint="We use this only to confirm you're 18 or older."
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
              I accept the <Link to="/legal/terms">Terms of Service</Link> and have read the{" "}
              <Link to="/legal/privacy">Privacy Policy</Link>.
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
            <span>Email me about new releases and offers. You can change this any time.</span>
          </label>
        </div>

        <button type="submit" className="primary-button auth-submit" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
