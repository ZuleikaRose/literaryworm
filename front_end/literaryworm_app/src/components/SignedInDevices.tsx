import { useEffect, useMemo, useState } from "react";
import { AccountError, loadSignedInDevices, signOutOtherDevices } from "../lib/accountApi";
import { deviceIdFor } from "../lib/deviceId";
import { dateLocale } from "../lib/i18n";
import { DEMO_HERE_ID, demoSignedInDevices, devicesForList, otherDevices, type SeenDevice } from "../lib/signedInDevices";
import { useAccount } from "../lib/useAccount";
import { useT } from "../lib/useT";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * Where you're logged in, in Account → Sign-in: the account's devices from the last day, and
 * Log out on every other device (`signOutOtherDevices()`), for a lost phone or a shared computer.
 */
export function SignedInDevices({ userId, isDemo }: { userId: string | null; isDemo: boolean }) {
  const t = useT();
  const { remote } = useAccount();
  const [now] = useState(() => Date.now());
  const [devices, setDevices] = useState<SeenDevice[] | null>(() => (isDemo ? demoSignedInDevices(now) : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hereId = isDemo ? DEMO_HERE_ID : remote && userId ? deviceIdFor(userId) : null;

  useEffect(() => {
    if (!remote) return;
    let live = true;
    loadSignedInDevices().then(
      (value) => live && setDevices(value),
      (err: Error) => live && setLoadError(err.message),
    );
    return () => {
      live = false;
    };
  }, [remote]);

  const list = useMemo(() => devicesForList(devices ?? [], hereId, now), [devices, hereId, now]);
  const others = otherDevices(list);
  const seen = (at: number) => new Intl.DateTimeFormat(dateLocale(), { dateStyle: "medium", timeStyle: "short" }).format(at);

  const logOutOthers = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutOtherDevices(hereId);
      setDevices((current) => (current ?? []).filter((d) => d.id === hereId));
      setConfirming(false);
      setNotice(t("Your other devices are logged out. Anything still open on one stops within an hour."));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-form">
      <h3>{t("Where you're logged in")}</h3>
      <p className="field-hint">
        {t("Devices that have had LiteraryWorm open in the last day. If you've lost one, or logged in somewhere you shouldn't stay logged in, log out on every other device.")}
      </p>
      {isDemo && <p className="field-hint">{t("The demo household can't log devices out. This is a sample of how the list looks.")}</p>}
      {!remote && !isDemo && <p className="field-hint">{t("This needs a LiteraryWorm account.")}</p>}
      {list.length > 0 && (
        <ul className="passkey-list" aria-label={t("Devices logged in to your account")}>
          {list.map((d) => (
            <li key={d.id} className="passkey-item">
              <Icon name="devices" size={20} />
              <div className="passkey-text">
                <strong>{d.label}</strong>
                <small>{d.here ? t("This device") : d.open ? t("Open now") : t("Last seen {time}", { time: seen(d.lastSeenAt) })}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(remote || isDemo) && (
        <button
          type="button"
          className="secondary-button"
          disabled={isDemo || devices === null}
          onClick={() => {
            setConfirming(true);
            setError(null);
            setNotice(null);
          }}
        >
          {t("Log out on every other device")}
        </button>
      )}
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
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        eyebrow={t("Where you're logged in")}
        title={t("Log out on every other device?")}
        description={
          <>
            <p>
              {others > 0
                ? t.plural(others, { one: "{count} other device is on the list.", other: "{count} other devices are on the list." })
                : t("No other device has had LiteraryWorm open in the last day, but any that are still logged in are logged out too.")}
            </p>
            <p>{t("Every other phone, tablet and computer is logged out and stops getting notifications. Anything still open on one stops within an hour. You stay logged in here.")}</p>
          </>
        }
      >
        {error && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{error}</p>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="danger-button" disabled={busy} onClick={logOutOthers}>
            {busy ? t("Logging out…") : t("Log them out")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            {t("Cancel")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
