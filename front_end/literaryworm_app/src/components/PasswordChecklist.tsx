import { Icon } from "./Icon";
import { useT } from "../lib/useT";
import { PASSWORD_MAX, PASSWORD_MIN, passwordChecks, type PasswordCheck } from "../lib/validation";

/**
 * The rules a new password must meet, ticked off as the member types (the same rules as
 * `validateNewPassword()` and Supabase Auth). Shown inside a field's hint, so it's read with the field.
 */
export function PasswordChecklist({ password }: { password: string }) {
  const t = useT();
  const labels: Record<PasswordCheck, string> = {
    length: t("{min} to {max} characters", { min: PASSWORD_MIN, max: PASSWORD_MAX }),
    lower: t("A lowercase letter"),
    upper: t("A capital"),
    number: t("A number"),
    symbol: t("A symbol such as ! ? # or %"),
  };
  return (
    <span className="password-checks">
      {passwordChecks(password).map(({ id, ok }) => (
        <span key={id} className={ok ? "password-check password-check-ok" : "password-check"}>
          <span className="password-check-mark" aria-hidden="true">
            {ok ? <Icon name="check" size={13} /> : null}
          </span>
          {labels[id]}
          <span className="visually-hidden">{ok ? ` (${t("Done")})` : ` (${t("Not yet")})`}</span>
        </span>
      ))}
    </span>
  );
}
