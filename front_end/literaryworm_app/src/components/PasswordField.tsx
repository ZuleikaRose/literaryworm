import { useT } from "../lib/useT";
import { useState, type ComponentProps } from "react";
import { Field } from "./Field";

type PasswordFieldProps = Omit<ComponentProps<typeof Field>, "type" | "trailing">;

/** Password input with a show/hide toggle, so people can check what they typed. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const t = useT();
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        // The name keeps the word on the button (Show) inside it, in every language.
        <button
          type="button"
          className="field-toggle"
          aria-pressed={visible}
          aria-label={visible ? t("Hide password") : t("Show password")}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? t("Hide") : t("Show")}
        </button>
      }
    />
  );
}
