import { useEffect, useState } from "react";
import { AccountError } from "../lib/accountApi";
import { CLI_LOGIN, type ConnectedApp, demoConnectedApps, MCP_URL } from "../lib/connectedApps";
import { listConnectedApps, removeConnectedApp } from "../lib/connectedAppsApi";
import { useAccount } from "../lib/useAccount";
import { useT } from "../lib/useT";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Account → Sign-in → Connected apps: how to connect an AI assistant (MCP) or the command line,
 * and the apps this account has allowed, each with Remove. Connected apps only read. The demo
 * household shows a sample kept in memory and connects nothing.
 */
export function ConnectedApps({ isDemo }: { isDemo: boolean }) {
  const t = useT();
  const { remote } = useAccount();
  const [list, setList] = useState<ConnectedApp[] | null>(() => (isDemo ? demoConnectedApps() : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ConnectedApp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!remote) return;
    let live = true;
    listConnectedApps().then(
      (value) => live && setList(value),
      (err: Error) => live && setLoadError(err.message),
    );
    return () => {
      live = false;
    };
  }, [remote]);

  const confirmRemove = async () => {
    if (!removing) return;
    const gone = removing;
    setBusy(true);
    setError(null);
    try {
      if (remote) await removeConnectedApp(gone.id);
      setList((current) => (current ?? []).filter((a) => a.id !== gone.id));
      setRemoving(null);
      setNotice(t("{name} removed. It can't read your account any more.", { name: gone.name }));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-form">
      <h3>{t("Connected apps")}</h3>
      <p className="field-hint">
        {t(
          "Connect an AI assistant or the LiteraryWorm command line to read your library, your place in each book, your highlights and notes, and your reading time. Connected apps can't change anything, and never see your password, your payment details or a Kids profile's reading time.",
        )}
      </p>
      <p className="field-hint">
        {t("In an assistant that supports MCP, add this address:")} <code className="connect-address">{MCP_URL}</code>
      </p>
      <p className="field-hint">
        {t("Or use the command line:")} <code className="connect-address">{CLI_LOGIN}</code>
      </p>
      {isDemo && <p className="field-hint">{t("The demo household can't connect apps. This is a sample of how one looks.")}</p>}
      {!remote && !isDemo && <p className="field-hint">{t("Connecting an app needs a LiteraryWorm account.")}</p>}
      {list && list.length > 0 && (
        <ul className="passkey-list" aria-label={t("Your connected apps")}>
          {list.map((app) => (
            <li key={app.id} className="passkey-item">
              <Icon name="devices" size={20} />
              <div className="passkey-text">
                <strong>{app.name}</strong>
                <small>
                  {t("Connected {date}", { date: day(app.createdAt) })}
                  {app.lastUsedAt ? ` · ${t("last used {date}", { date: day(app.lastUsedAt) })}` : ` · ${t("not used yet")}`}
                </small>
              </div>
              <div className="passkey-actions">
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => {
                    setRemoving(app);
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {t("Remove")}
                  <span className="visually-hidden"> {app.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && <p className="field-hint">{t("No apps connected.")}</p>}
      {loadError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{loadError}</p>
        </div>
      )}
      {notice && (
        <div className="form-success" role="status">
          <Icon name="check" size={17} />
          <p>{notice}</p>
        </div>
      )}

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        eyebrow={t("Connected apps")}
        title={removing ? t("Remove {name}?", { name: removing.name }) : t("Connected apps")}
        description={<p>{t("It won't be able to read your account any more. To use it again, connect it again.")}</p>}
      >
        {error && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{error}</p>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="danger-button" disabled={busy} onClick={confirmRemove}>
            {busy ? t("Removing…") : t("Remove")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setRemoving(null)}>
            {t("Keep it")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
