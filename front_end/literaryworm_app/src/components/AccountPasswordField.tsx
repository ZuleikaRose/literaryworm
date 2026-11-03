import type { Ref } from "react";
import { useStore } from "../store/context";
import { DEMO_ACCOUNT_PASSWORD } from "../store/state";
import { PasswordField } from "./PasswordField";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";

interface AccountPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  label?: string;
  ref?: Ref<HTMLInputElement>;
}

/** The account holder's password, asked for before protected changes. Shows the demo password in the demo. */
export function AccountPasswordField({ value, onChange, error, label, ref }: AccountPasswordFieldProps) {
  const { state } = useStore();
  const t = useT();
  return (
    <PasswordField
      ref={ref}
      label={label ?? t("Account password")}
      autoComplete="current-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={
        state.account?.isDemo ? (
          <>
            {rich(t("Demo account password: {password}"), { password: <strong>{DEMO_ACCOUNT_PASSWORD}</strong> })}
          </>
        ) : (
          t("The password for the whole account, not a profile PIN.")
        )
      }
    />
  );
}

