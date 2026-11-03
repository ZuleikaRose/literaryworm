import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { AccountError, setNewPassword } from "../lib/accountApi";
import { useT } from "../lib/useT";
import { useTitle } from "../lib/useTitle";
import { PASSWORD_MAX, PASSWORD_MIN, validateNewPassword } from "../lib/validation";
import { useStore } from "../store/context";

/**
 * /reset-password: where the emailed reset link lands. Supabase signs the person in from the
 * link, so they only choose a new password here.
 */
export default function ResetPassword() {
  const t = useT();
  useTitle(t("Choose a new password"));
  const { state } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.authReady && !state.account?.userId) {
    return (
      <AuthCard
        eyebrow={t("Reset link")}
        title={t("This link has expired")}
        intro={<p>{t("Reset links work once, for 1 hour. Ask for a new one from the log-in page.")}</p>}
      >
        <Link className="primary-button auth-submit" to="/signin">
          {t("Go to log in")}
        </Link>
      </AuthCard>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password);
    setError(problem);
    if (problem) return;
    setBusy(true);
    setFormError(null);
    try {
      await setNewPassword(password);
      navigate("/profiles", { replace: true, state: { passwordChanged: true } });
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow={t("Reset your password")}
      title={t("Choose a new password")}
      intro={<p>{t("You'll stay logged in on this device. Other devices keep working until their session ends.")}</p>}
    >
      {formError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{formError}</p>
        </div>
      )}
      <form className="auth-form" noValidate onSubmit={submit}>
        <PasswordField
          label={t("New password")}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          hint={t("{min} to {max} characters. A short phrase is strong.", { min: PASSWORD_MIN, max: PASSWORD_MAX })}
        />
        <button type="submit" className="primary-button auth-submit" disabled={busy || !state.authReady}>
          {busy ? t("Saving…") : t("Save new password")}
        </button>
      </form>
    </AuthCard>
  );
}
