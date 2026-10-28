import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Shown above the title, wireframe style. */
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
}

/**
 * Modal built on the native <dialog>: it traps focus, makes the page behind inert,
 * closes on Escape, and returns focus to whatever opened it.
 */
export function Dialog({ open, onClose, title, eyebrow, description, children, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Escape: let React state drive closing so the two never disagree.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="modal-body">
          <button type="button" className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} />
            <span className="visually-hidden">Close</span>
          </button>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {description && (
            <div id={descId} className="modal-description">
              {description}
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
