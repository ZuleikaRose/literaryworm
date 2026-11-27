import { type FormEvent, useEffect, useRef, useState } from "react";
import { AccountError, makeRecoveryCodes, recoveryCodesLeft } from "../lib/accountApi";
import { saveFile } from "../lib/audiobookExport";
import { tr } from "../lib/i18n";
import { recoveryCodesFileName, recoveryCodesText } from "../lib/recoveryCodes";
import { useT } from "../lib/useT";
import { AccountPasswordField } from "./AccountPasswordField";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * Recovery codes, under Two-step sign-in in Account → Sign-in while it's on (members only): how many
 * still work, and making a new set after the account password. The codes are shown once, to copy or
 * download (made in the browser, never sent); the database keeps only hashes.
 */
export function RecoveryCodes({ email }: { email: string }) {
  const t = useT();
  const [left, setLeft] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [madeOn, setMadeOn] = useState(() => new Date());
  const [copied, setCopied] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let live = true;
    recoveryCodesLeft().then(
      (n) => live && setLeft(n),
      (err: Error) => live && setLoadError(err instanceof AccountError ? err.message : tr("Something went wrong. Try again.")),
    );
    return () => {
      live = false;
    };
  }, []);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError(null);
    setCodes(null);
    setCopied(null);
  };

  const make = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t("Enter your account password."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const made = await makeRecoveryCodes(email, password);
      setCodes(made);
      setMadeOn(new Date());
      setLeft(made.length);
      setPassword("");
      setTimeout(() => listRef.current?.focus(), 0);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const text = codes ? recoveryCodesText(codes, madeOn, email) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(t("Copied. Paste them somewhere safe, such as your password manager."));
    } catch {
      setCopied(t("Your browser didn't let us copy them. Download them instead, or write them down."));
    }
  };

  return (
    <div className="recovery-codes">
      <h4>{t("Recovery codes")}</h4>
      <p className="field-hint">
        {t(
          "If you lose the phone with your authenticator app, a recovery code logs you in instead. Each code works once, and using one turns two-step sign-in off so you can set it up again on a new phone.",
        )}
      </p>
      {left !== null && (
        <div className="account-fact-row">
          <span>{t("Recovery codes left")}</span>
          <strong>{left > 0 ? t.plural(left, { one: "{count} code", other: "{count} codes" }) : t("None yet")}</strong>
        </div>
      )}
      {loadError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{loadError}</p>
        </div>
      )}
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        {left ? t("Make new recovery codes") : t("Make recovery codes")}
      </button>

      <Dialog
        open={open}
        onClose={close}
        size="sm"
        eyebrow={t("Two-step sign-in")}
        title={codes ? t("Save your recovery codes") : t("Make recovery codes")}
        description={
          <p>
            {codes
              ? t("Keep them somewhere safe, such as your password manager or a printed page. This is the only time you'll see them.")
              : t("Enter your account password. Ten new codes replace any you made before, and the old ones stop working.")}
          </p>
        }
      >
        {codes ? (
          <div className="two-step-form">
            <ol ref={listRef} tabIndex={-1} className="recovery-code-list" aria-label={t("Your recovery codes")}>
              {codes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ol>
            <div className="recovery-code-actions">
              <button type="button" className="secondary-button" onClick={() => void copy()}>
                <Icon name="list" size={17} />
                {t("Copy")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => saveFile(new Blob([text], { type: "text/plain;charset=utf-8" }), recoveryCodesFileName(madeOn))}
              >
                <Icon name="download" size={17} />
                {t("Download")}
              </button>
            </div>
            {copied && (
              <p className="field-hint" role="status">
                {copied}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={close}>
                {t("I've saved them")}
              </button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={make} className="two-step-form">
            <AccountPasswordField
              value={password}
              onChange={(v) => {
                setPassword(v);
                setError(null);
              }}
              error={error}
            />
            <div className="modal-actions">
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? t("Making codes…") : t("Make codes")}
              </button>
              <button type="button" className="secondary-button" onClick={close}>
                {t("Cancel")}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
