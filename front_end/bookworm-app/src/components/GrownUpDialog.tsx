import { useState, type FormEvent } from "react";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { AccountPasswordField } from "./AccountPasswordField";
import { Dialog } from "./Dialog";

interface GrownUpDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  /** What the grown-up is about to do, e.g. "manage profiles". */
  action: string;
}

/** "Ask a grown-up": the account password before a Kids reader reaches protected settings. */
export function GrownUpDialog({ open, onClose, onConfirmed, action }: GrownUpDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Ask a grown-up"
      title={`A grown-up needs to ${action}`}
      description={<p>Ask the account holder to enter the account password to continue.</p>}
      size="sm"
    >
      {open && <GrownUpForm onConfirmed={onConfirmed} />}
    </Dialog>
  );
}

function GrownUpForm({ onConfirmed }: { onConfirmed: () => void }) {
  const check = useCheckAccountPassword();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await check(password);
    setBusy(false);
    if (!ok) {
      setError("That isn't the account password.");
      return;
    }
    onConfirmed();
  };
  return (
    <form noValidate onSubmit={submit}>
      <AccountPasswordField value={password} onChange={setPassword} error={error} />
      <button type="submit" className="primary-button modal-submit" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
