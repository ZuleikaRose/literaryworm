import { useState, type FormEvent } from "react";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { AccountPasswordField } from "./AccountPasswordField";
import { Dialog } from "./Dialog";
import { useT } from "../lib/useT";

interface GrownUpDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  /** What the grown-up is about to do, e.g. "manage profiles". */
  action: string;
}

/** "Ask a grown-up": the account password before a Kids reader reaches protected settings. */
export function GrownUpDialog({ open, onClose, onConfirmed, action }: GrownUpDialogProps) {
  const t = useT();
  // Each action the app asks for is its own sentence, so it reads well in every language.
  const title =
    action === "add a profile"
      ? t("A grown-up needs to add a profile")
      : action === "manage profiles"
        ? t("A grown-up needs to manage profiles")
        : action === "open Account"
          ? t("A grown-up needs to open Account")
          : t("A grown-up needs to {action}", { action });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={t("Ask a grown-up")}
      title={title}
      description={<p>{t("Ask the account holder to enter the account password to continue.")}</p>}
      size="sm"
    >
      {open && <GrownUpForm onConfirmed={onConfirmed} />}
    </Dialog>
  );
}

function GrownUpForm({ onConfirmed }: { onConfirmed: () => void }) {
  const t = useT();
  const check = useCheckAccountPassword();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await check(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.problem ?? t("That isn't the account password."));
      return;
    }
    onConfirmed();
  };
  return (
    <form noValidate onSubmit={submit}>
      <AccountPasswordField value={password} onChange={setPassword} error={error} />
      <button type="submit" className="primary-button modal-submit" disabled={busy}>
        {busy ? t("Checking…") : t("Continue")}
      </button>
    </form>
  );
}
