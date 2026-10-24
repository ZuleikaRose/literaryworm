import { useState, type ComponentProps } from "react";
import { Field } from "./Field";

type PasswordFieldProps = Omit<ComponentProps<typeof Field>, "type" | "trailing">;

/** Password input with a show/hide toggle, so people can check what they typed. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button type="button" className="field-toggle" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? "Hide" : "Show"}
          <span className="visually-hidden"> password</span>
        </button>
      }
    />
  );
}
