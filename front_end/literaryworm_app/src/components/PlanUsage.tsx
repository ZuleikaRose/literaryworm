import { useEffect, useState } from "react";
import { freeOfflineDevice, listeningBetween, listOfflineDevices, type OfflineDevice } from "../lib/accountApi";
import { readOfflinePlace } from "../lib/offline";
import { listenedThisMonth, monthRange, nextMonthLabel, planLimits } from "../lib/planLimits";
import { today } from "../lib/reading";
import { useStore } from "../store/context";
import type { PlanId } from "../types";

const hoursAndMinutes = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/**
 * Account → Plan: how much of the plan's limits is used. This month's listening for the whole
 * household (lib/useListeningAllowance.ts pauses the player at the limit) and, for members, the
 * devices holding offline places, each of which can be freed (lib/offlinePlaces.ts).
 */
export function PlanUsage({ planId }: { planId: PlanId }) {
  const { state } = useStore();
  const member = Boolean(state.account?.userId);
  const { audioSeconds, offlineDevices } = planLimits(planId);
  const day = today();
  const local = listenedThisMonth(
    state.profiles.map((p) => state.profileData[p.id]?.readingDays ?? {}),
    day,
  );

  const [server, setServer] = useState(0);
  const [devices, setDevices] = useState<OfflineDevice[] | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeing, setFreeing] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!member) return;
    let live = true;
    const { from, to } = monthRange(today());
    listeningBetween(from, to).then(
      (s) => live && setServer(s),
      (err: Error) => console.error("plan usage:", err.message),
    );
    listOfflineDevices().then(
      (d) => live && setDevices(d),
      (err: Error) => live && setError(err.message),
    );
    readOfflinePlace().then(
      (p) => live && setThisDevice(p?.id ?? null),
      () => live && setThisDevice(null),
    );
    return () => {
      live = false;
    };
  }, [member, version]);

  const free = async (device: OfflineDevice) => {
    setFreeing(device.id);
    setError(null);
    try {
      await freeOfflineDevice(device.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't free that device. Try again.");
    } finally {
      setFreeing(null);
      setVersion((n) => n + 1);
    }
  };

  const listened = Math.max(server, local);
  return (
    <div className="plan-usage">
      <h3>This month</h3>
      <dl className="account-facts">
        <div>
          <dt>Audiobooks</dt>
          <dd>
            {audioSeconds === null
              ? `${hoursAndMinutes(listened)} listened. Unlimited on this plan.`
              : `${hoursAndMinutes(Math.min(listened, audioSeconds))} of ${audioSeconds / 3600} hours listened, for the whole household. ${
                  listened >= audioSeconds ? `Listening starts again on ${nextMonthLabel(day)}.` : `Resets on ${nextMonthLabel(day)}.`
                }`}
          </dd>
        </div>
        {member && (
          <div>
            <dt>Offline devices</dt>
            <dd>
              {devices === null ? "Checking…" : `${devices.length} of ${offlineDevices} in use. A device takes a place when it first saves a book with Read offline.`}
            </dd>
          </div>
        )}
      </dl>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {devices !== null && devices.length > 0 && (
        <ul className="plan-devices" role="list" aria-label="Offline devices">
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                {d.label}
                {d.id === thisDevice && " (this device)"}
                <span className="muted"> · last used {new Date(d.lastSeenAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
              </span>
              <button type="button" className="ghost-button small-button" disabled={freeing !== null} onClick={() => free(d)}>
                {freeing === d.id ? "Freeing…" : "Free"}
                <span className="visually-hidden"> {d.label}: its offline books are removed</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
