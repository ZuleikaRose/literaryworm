import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { useTitle } from "../lib/useTitle";
import { credentialsMatch, validateEmail } from "../lib/validation";
import { useStore } from "../store/context";
import { DEMO_ACCOUNT_PASSWORD, DEMO_EMAIL } from "../store/state";

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
  const emailRef = useRef<HTMLInputElement>(null);
  useTitle(mode === "signin" ? "Log in" : "Reset your password");

  // Also catches the render right after signing in, so it must agree with afterSignIn() on where to go.
  if (state.account)
    return <Navigate to={state.account.planId ? "/profiles" : "/plans?setup=1"} replace state={from ? { from } : undefined} />;

  const afterSignIn = () => navigate("/profiles", { replace: true, state: from ? { from } : undefined });

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    if (!password || !credentialsMatch(state, email, password)) {
      // Same message whether or not the email exists.
      setFormError("That email and password don't match an account. Check them and try again, or reset your password.");
      return;
    }
    dispatch({ type: "signIn", email });
    afterSignIn();
  };

  const tryDemo = () => {
    dispatch({ type: "startDemo" });
    afterSignIn();
  };

  const sendReset = (e: FormEvent) => {
    e.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    setMode("sent");
  };

  if (mode === "sent") {
    return (
      <AuthCard
        eyebrow="Check your email"
        title="Reset link on its way"
        intro={
          <p>
            If an account uses <strong>{email.trim()}</strong>, we've sent a link to choose a new password. It works for 1
            hour.
          </p>
        }
      >
        <p className="auth-note">This demo doesn't send email, so no message will arrive.</p>
        <button type="button" className="secondary-button auth-submit" onClick={() => setMode("signin")}>
          <Icon name="arrowLeft" size={16} /> Back to log in
        </button>
      </AuthCard>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthCard
        eyebrow="Forgot password"
        title="Reset your password"
        intro={<p>Enter the email you signed up with and we'll send you a link to choose a new password.</p>}
        footer={
          <button type="button" onClick={() => setMode("signin")}>
            Back to log in
          </button>
        }
      >
        <form className="auth-form" noValidate onSubmit={sendReset}>
          <Field
            ref={emailRef}
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <button type="submit" className="primary-button auth-submit">
            Send reset link
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in to your account"
      intro={<p>Pick up where you left off on any device.</p>}
      footer={
        <>
          <span>New to BookWorm?</span>
          <Link to="/signup">Sign up</Link>
        </>
      }
    >
      {formError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{formError}</p>
        </div>
      )}
      <form className="auth-form" noValidate onSubmit={signIn}>
        <Field
          ref={emailRef}
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="text-button forgot-link" onClick={() => setMode("forgot")}>
          Forgot password?
        </button>
        <button type="submit" className="primary-button auth-submit">
          Log in
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>
      <button type="button" className="secondary-button auth-submit" onClick={tryDemo}>
        Try the demo
      </button>
      <p className="auth-note">
        Opens a sample household with three profiles. You can also log in with <strong>{DEMO_EMAIL}</strong> and{" "}
        <strong>{DEMO_ACCOUNT_PASSWORD}</strong>. The demo can't make payments.
      </p>
    </AuthCard>
  );
}
