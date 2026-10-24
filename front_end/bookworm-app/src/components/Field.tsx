import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "./Icon";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Element placed after the input, such as a show/hide button. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled input with its hint and error wired up for screen readers. */
export function Field({ label, hint, error, trailing, className, ...input }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The error replaces the hint, so describe the field by whichever one is showing.
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className={trailing ? "field-with-trailing" : undefined}>
        <input
          id={id}
          className="field-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {trailing}
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
