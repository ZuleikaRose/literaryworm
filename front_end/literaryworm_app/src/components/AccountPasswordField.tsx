import type { Ref } from "react";
import { useStore } from "../store/context";
import { DEMO_ACCOUNT_PASSWORD } from "../store/state";
import { PasswordField } from "./PasswordField";

interface AccountPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  label?: string;
  ref?: Ref<HTMLInputElement>;
}

/** The account holder's password, asked for before protected changes. Shows the demo password in the demo. */
export function AccountPasswordField({ value, onChange, error, label = "Account password", ref }: AccountPasswordFieldProps) {
  const { state } = useStore();
  return (
    <PasswordField
      ref={ref}
      label={label}
      autoComplete="current-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={
        state.account?.isDemo ? (
          <>
            Demo account password: <strong>{DEMO_ACCOUNT_PASSWORD}</strong>
          </>
        ) : (
          "The password for the whole account, not a profile PIN."
        )
      }
    />
  );
}

