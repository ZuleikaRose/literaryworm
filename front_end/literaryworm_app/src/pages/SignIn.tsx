import { DemoOnPhoneButton } from "../components/ContinueOnPhone";
import { demoLink } from "../lib/continueLink";
import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { ResendConfirmation } from "../components/ResendConfirmation";
import * as accountApi from "../lib/accountApi";
import { AccountError, UnconfirmedEmailError } from "../lib/accountApi";
import { usesBackend } from "../lib/backend";
import { passkeysSupported } from "../lib/passkeys";
import { looksLikeRecoveryCode } from "../lib/recoveryCodes";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { credentialsMatch, validateEmail } from "../lib/validation";
import { useStore } from "../store/context";
import { DEMO_ACCOUNT_PASSWORD, DEMO_EMAIL, emailKey } from "../store/state";

type Mode = "signin" | "forgot" | "sent";

export default function SignIn() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // The address that was refused for not being confirmed yet, to send its link again.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();
  const justConfirmed = params.get("confirmed") === "1";
  // Opened from the demo's QR code (lib/continueLink.ts demoLink()): Try the demo comes first.
  const fromDemoCode = params.get("demo") === "1";
  const t = useT();
  useTitle(mode === "signin" ? t("Log in") : t("Reset your password"));

  // Also catches the render right after signing in, so it must agree with afterSignIn() on where to go.
  if (state.account)
    return <Navigate to={state.account.planId ? "/profiles" : "/pricing?setup=1"} replace state={from ? { from } : undefined} />;

  // The password was right; two-step sign-in asks for the code before the account loads.
  if (state.secondStep) return <SecondStep />;

  const afterSignIn = () => navigate("/profiles", { replace: true, state: from ? { from } : undefined });

  // Real accounts sign in through Supabase; the demo (and every account without a backend) stays in memory.
  const isLocal = !usesBackend || emailKey(email) === DEMO_EMAIL;

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    if (!isLocal) {
      setBusy(true);
      setFormError(null);
      setUnconfirmed(null);
      try {
        await accountApi.signIn(email, password);
        // useAuthSync loads the account; the redirect above then takes over.
      } catch (err) {
        if (err instanceof UnconfirmedEmailError) setUnconfirmed(email);
        setFormError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
        setBusy(false);
      }
      return;
    }
    if (!password || !credentialsMatch(state, email, password)) {
      // Same message whether or not the email exists.
      setFormError(t("That email and password don't match an account. Check them and try again, or reset your password."));
      return;
    }
    dispatch({ type: "signIn", email });
    afterSignIn();
  };

  // A passkey picks the account itself, so no email is typed. Members only (the demo has none).
  const passkeyLogIn = async () => {
    setBusy(true);
    setFormError(null);
    setUnconfirmed(null);
    try {
      await accountApi.signInWithPasskey();
      // useAuthSync loads the account (or asks for the two-step code); the redirect above then takes over.
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      setBusy(false);
    }
  };

  const tryDemo = async () => {
    // The demo is a separate, in-memory household: leave any real session first.
    await accountApi.signOut();
    dispatch({ type: "startDemo" });
    afterSignIn();
  };

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    if (!isLocal) {
      setBusy(true);
      try {
        await accountApi.sendPasswordReset(email);
      } catch (err) {
        setEmailError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setMode("sent");
  };

  if (mode === "sent") {
    return (
      <AuthCard
        eyebrow={t("Check your email")}
        title={t("Reset link on its way")}
        intro={<p>{rich(t("If an account uses {email}, we've sent a link to choose a new password. It works for 1 hour."), { email: <strong>{email.trim()}</strong> })}</p>}
      >
        {isLocal ? (
          <p className="auth-note">{t("The demo doesn't send email, so no message will arrive.")}</p>
        ) : (
          <p className="auth-note">{t("No email after a few minutes? Check your spam folder, or try again.")}</p>
        )}
        <button type="button" className="secondary-button auth-submit" onClick={() => setMode("signin")}>
          <Icon name="arrowLeft" size={16} /> {t("Back to log in")}
        </button>
      </AuthCard>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthCard
        eyebrow={t("Forgot password")}
        title={t("Reset your password")}
        intro={<p>{t("Enter the email you signed up with and we'll send you a link to choose a new password.")}</p>}
        footer={
          <button type="button" onClick={() => setMode("signin")}>
            {t("Back to log in")}
          </button>
        }
      >
        <form className="auth-form" noValidate onSubmit={sendReset}>
          <Field
            ref={emailRef}
            label={t("Email address")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy ? t("Sending…") : t("Send reset link")}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={t("Welcome back")}
      title={t("Log in to your account")}
      intro={<p>{t("Pick up where you left off on any device.")}</p>}
      footer={
        <>
          <span>{t("New to LiteraryWorm?")}</span>
          <Link to="/signup">{t("Sign up")}</Link>
        </>
      }
    >
      {state.authError && !formError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{state.authError}</p>
        </div>
      )}
      {fromDemoCode && (
        <div className="form-success demo-code-start" role="status">
          <p>{t("Opened from a demo code? Try the demo to look around a sample household. Nothing is saved, and no account is needed.")}</p>
          <button type="button" className="primary-button auth-submit" onClick={tryDemo}>
            {t("Try the demo")}
          </button>
        </div>
      )}
      {justConfirmed && !formError && (
        <div className="form-success" role="status">
          <Icon name="check" size={17} />
          <p>{t("Your email is confirmed. Log in to finish setting up your account.")}</p>
        </div>
      )}
      {formError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{formError}</p>
        </div>
      )}
      {unconfirmed && formError && <ResendConfirmation email={unconfirmed} />}
      <form className="auth-form" noValidate onSubmit={signIn}>
        <Field
          ref={emailRef}
          label={t("Email address")}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("you@example.com")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <PasswordField
          label={t("Password")}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="text-button forgot-link" onClick={() => setMode("forgot")}>
          {t("Forgot password?")}
        </button>
        <button type="submit" className="primary-button auth-submit" disabled={busy}>
          {busy ? t("Logging in…") : t("Log in")}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t("or")}</span>
      </div>
      {usesBackend && passkeysSupported() && (
        <button type="button" className="secondary-button auth-submit" onClick={passkeyLogIn} disabled={busy}>
          <Icon name="key" size={16} /> {t("Log in with a passkey")}
        </button>
      )}
      <button type="button" className="secondary-button auth-submit" onClick={tryDemo}>
        {t("Try the demo")}
      </button>
      <div className="auth-note">
        <DemoOnPhoneButton url={demoLink()} />
      </div>
      <p className="auth-note">
        {rich(t("Opens a sample household with three profiles. You can also log in with {email} and {password}. The demo can't make payments."), {
          email: <strong>{DEMO_EMAIL}</strong>,
          password: <strong>{DEMO_ACCOUNT_PASSWORD}</strong>,
        })}
      </p>
      <p className="auth-note">
        {t(
          "Log in not responding? LiteraryWorm never needs access to your local network. If your browser asks, choose Block. If you allowed it, set Local network access to Block in this site's settings, then reload.",
        )}{" "}
        <Link to="/legal/help">{t("Help with logging in")}</Link>
      </p>
    </AuthCard>
  );
}

/**
 * The second step of logging in: a 6-digit code from the member's authenticator app, or one of their
 * recovery codes (lib/recoveryCodes.ts), which turns two-step sign-in off so they can set it up again.
 */
function SecondStep() {
  const [recovery, setRecovery] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const t = useT();
  useTitle(recovered ? t("Two-step sign-in is off") : recovery ? t("Enter a recovery code") : t("Enter your code"));

  const switchTo = (useRecovery: boolean) => {
    setRecovery(useRecovery);
    setCode("");
    setError(null);
    // The field is replaced; focus the new one once it's there.
    setTimeout(() => codeRef.current?.focus(), 0);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (recovery) {
      if (!looksLikeRecoveryCode(code)) {
        setError(t("Enter one of your recovery codes: 10 letters and numbers, such as 7k2mp-q9xzt."));
        codeRef.current?.focus();
        return;
      }
    } else if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      setError(t("Enter the 6-digit code from your authenticator app."));
      codeRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (recovery) {
        await accountApi.redeemRecoveryCode(code);
        setRecovered(true);
        setBusy(false);
        setTimeout(() => continueRef.current?.focus(), 0);
      } else {
        await accountApi.verifySecondStep(code.replace(/\s/g, ""));
        // useAuthSync loads the account; the log-in page then moves on.
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      setBusy(false);
      codeRef.current?.focus();
    }
  };

  // The code was right and two-step sign-in is off: refreshing the session lets useAuthSync load the
  // account, and after the profile is chosen Account → Sign-in opens to set it up again.
  const carryOn = async () => {
    setBusy(true);
    setError(null);
    navigate("/signin", { replace: true, state: { from: "/account#sign-in" } });
    try {
      await accountApi.refreshAfterRecovery();
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      setBusy(false);
    }
  };

  const logOut = (
    <>
      <span>{t("Not you, or no access to the app?")}</span>
      <button type="button" onClick={() => void accountApi.signOut()}>
        {t("Log out")}
      </button>
    </>
  );

  if (recovered) {
    return (
      <AuthCard
        eyebrow={t("Two-step sign-in")}
        title={t("Two-step sign-in is off")}
        intro={
          <p>
            {t(
              "That recovery code was right, so two-step sign-in is off and your recovery codes no longer work. Set it up again with your new phone, and make new recovery codes, in Account → Sign-in.",
            )}
          </p>
        }
      >
        <div className="auth-form">
          {error && (
            <div className="form-alert" role="alert">
              <Icon name="alert" size={17} />
              <p>{error}</p>
            </div>
          )}
          <button ref={continueRef} type="button" className="primary-button auth-submit" disabled={busy} onClick={() => void carryOn()}>
            {busy ? t("Logging in…") : t("Continue")}
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={t("Two-step sign-in")}
      title={recovery ? t("Enter a recovery code") : t("Enter your code")}
      intro={
        <p>
          {recovery
            ? t("Enter one of the recovery codes you saved when you turned on two-step sign-in. Each code works once, and using one turns two-step sign-in off so you can set it up again on a new phone.")
            : t("Open your authenticator app and enter the 6-digit code it shows for LiteraryWorm.")}
        </p>
      }
      footer={logOut}
    >
      <form className="auth-form" noValidate onSubmit={submit}>
        {recovery ? (
          <Field
            key="recovery"
            ref={codeRef}
            label={t("Recovery code")}
            hint={t("Capitals, spaces and dashes don't matter.")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            error={error}
          />
        ) : (
          <Field
            key="app"
            ref={codeRef}
            label={t("6-digit code")}
            hint={t("The code changes every 30 seconds. Use the newest one.")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            error={error}
          />
        )}
        <button type="submit" className="primary-button auth-submit" disabled={busy}>
          {busy ? t("Checking…") : t("Log in")}
        </button>
      </form>
      <p className="auth-note">
        <button type="button" className="text-button" onClick={() => switchTo(!recovery)}>
          {recovery ? t("Use the code from your authenticator app instead") : t("Lost your phone? Use a recovery code")}
        </button>
      </p>
      <p className="auth-note">
        {rich(t("No recovery codes either? Write to {email} from your account's email and we'll help you back in."), {
          email: <a href="mailto:support@literaryworm.com">support@literaryworm.com</a>,
        })}
      </p>
    </AuthCard>
  );
}
