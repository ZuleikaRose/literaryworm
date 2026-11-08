import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { freeOfflineDevice, listeningBetween, listOfflineDevices, type OfflineDevice } from "../lib/accountApi";
import { readOfflinePlace } from "../lib/offline";
import { hoursAndMinutes, LISTENING_ALERT_SHARE, listenedThisMonth, monthRange, nextMonthLabel, nextPlanUp, planCheckoutPath, planLimits } from "../lib/planLimits";
import { today } from "../lib/reading";
import { useStore } from "../store/context";
import type { PlanId } from "../types";
import { dateLocale } from "../lib/i18n";
import { useT } from "../lib/useT";
import { useNaturalVoiceUsage } from "../lib/useNaturalVoice";
import { VoicePacks } from "./VoicePacks";

/**
 * Account → Plan: how much of the plan's limits is used. This month's listening for the whole
 * household (lib/useListeningAllowance.ts pauses the player at the limit) and, for members, the
 * devices holding offline places, each of which can be freed (lib/offlinePlaces.ts).
 */
export function PlanUsage({ planId }: { planId: PlanId }) {
  const { state } = useStore();
  const t = useT();
  const member = Boolean(state.account?.userId);
  const { audioSeconds, offlineDevices } = planLimits(planId);
  const day = today();
  const local = listenedThisMonth(
    state.profiles.map((p) => state.profileData[p.id]?.readingDays ?? {}),
    day,
  );

  const natural = useNaturalVoiceUsage();
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
      setError(err instanceof Error ? err.message : t("We couldn't free that device. Try again."));
    } finally {
      setFreeing(null);
      setVersion((n) => n + 1);
    }
  };

  const listened = Math.max(server, local);
  const next = nextPlanUp(planId);
  const nearlyOut = (audioSeconds !== null && listened >= audioSeconds * LISTENING_ALERT_SHARE) || (devices !== null && devices.length >= offlineDevices);
  return (
    <div className="plan-usage">
      <h3>{t("This month")}</h3>
      <dl className="account-facts">
        <div>
          <dt>{t("Audiobooks")}</dt>
          <dd>
            {audioSeconds === null
              ? t("{time} listened. Unlimited on this plan.", { time: hoursAndMinutes(listened) })
              : `${t("{time} of {hours} hours listened, for the whole household.", {
                  time: hoursAndMinutes(Math.min(listened, audioSeconds)),
                  hours: audioSeconds / 3600,
                })} ${
                  listened >= audioSeconds
                    ? t("Listening starts again on {date}.", { date: nextMonthLabel(day) })
                    : t("Resets on {date}.", { date: nextMonthLabel(day) })
                }`}
          </dd>
        </div>
        {natural && natural.limit > 0 && (
          <div>
            <dt>{t("Natural voices")}</dt>
            <dd>
              {natural.paused
                ? t("Paused because your last payment didn't go through. They come back as soon as a payment succeeds.")
                : natural.trial
                  ? t("{time} of your free week's 1 hour of new natural-voice reading used; {left} left. Your plan's full hours start with your first payment.", {
                      time: hoursAndMinutes(natural.used),
                      left: hoursAndMinutes(natural.left),
                    })
                  : t("{time} of {hours} hours of new natural-voice reading used for your uploads and the classics; {left} left. Listening again to parts already voiced is free. Resets on {date}.", {
                      time: hoursAndMinutes(natural.used),
                      hours: Math.round(natural.limit / 3600),
                      // The plan's own hours; bought ones are shown under it.
                      left: hoursAndMinutes(Math.max(0, natural.left - natural.extra)),
                      date: nextMonthLabel(day),
                    })}
              {!natural.trial && !natural.paused && <VoicePacks packs={natural.packs} extra={natural.extra} />}
            </dd>
          </div>
        )}
        {!member && (
          <div>
            <dt>{t("Natural voices")}</dt>
            <dd>
              {t("Members' uploads and the classics can be read by natural voices, with hours each month on every plan.")}
              <VoicePacks packs={[]} extra={0} />
            </dd>
          </div>
        )}
        {member && (
          <div>
            <dt>{t("Offline devices")}</dt>
            <dd>
              {devices === null
                ? t("Checking…")
                : t("{used} of {total} in use. A device takes a place when it first saves a book with Read offline.", { used: devices.length, total: offlineDevices })}
            </dd>
          </div>
        )}
      </dl>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {next && nearlyOut && (
        <p className="plan-move-up">
          <Link className="secondary-button" to={planCheckoutPath(next)}>
            {next.audioHoursPerMonth === null
              ? t("Move to {plan}: unlimited listening and {devices} offline devices", { plan: next.name, devices: next.offlineDevices })
              : t("Move to {plan}: {hours} hours and {devices} offline devices", {
                  plan: next.name,
                  hours: next.audioHoursPerMonth,
                  devices: next.offlineDevices,
                })}
          </Link>
        </p>
      )}
      {devices !== null && devices.length > 0 && (
        <ul className="plan-devices" role="list" aria-label={t("Offline devices")}>
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                {d.label}
                {d.id === thisDevice && ` ${t("(this device)")}`}
                <span className="muted">
                  {" · "}
                  {t("last used {date}", {
                    date: new Date(d.lastSeenAt).toLocaleDateString(t.lang === "en" ? "en-GB" : dateLocale(t.lang), { day: "numeric", month: "long" }),
                  })}
                </span>
              </span>
              <button type="button" className="ghost-button small-button" disabled={freeing !== null} onClick={() => free(d)}>
                {freeing === d.id ? t("Freeing…") : t("Free")}
                <span className="visually-hidden"> {t("{device}: its offline books are removed", { device: d.label })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
