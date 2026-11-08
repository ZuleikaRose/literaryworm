import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AccountError, buyVoiceHours } from "../lib/accountApi";
import { dateLocale } from "../lib/i18n";
import { hoursAndMinutes } from "../lib/planLimits";
import { useT } from "../lib/useT";
import { canBuyVoiceHours, livePacks, packPrice, VOICE_PACK_HOURS, type VoicePack, type VoicePackHours } from "../lib/voicePacks";
import { useStore } from "../store/context";
import { Icon } from "./Icon";

/**
 * Account → Plan and billing → This month, under Natural voices: hours left in bought packs and
 * the buttons to buy more (lib/voicePacks.ts). The demo shows the buttons and can't pay.
 */
export function VoicePacks({ packs, extra }: { packs: VoicePack[]; extra: number }) {
  const t = useT();
  const { state } = useStore();
  const account = state.account;
  const member = Boolean(account?.userId);
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<VoicePackHours | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = livePacks(packs);
  const allowed = member ? canBuyVoiceHours(account) : true;
  const when = (ms: number) => new Date(ms).toLocaleDateString(dateLocale(t.lang), { day: "numeric", month: "long", year: "numeric" });

  const buy = async (hours: VoicePackHours) => {
    setError(null);
    if (!member) {
      setError(t("The demo can't take payments. Members buy more hours here."));
      return;
    }
    setBusy(hours);
    try {
      window.location.assign(await buyVoiceHours(hours));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : t("We couldn't start the payment. Try again."));
      setBusy(null);
    }
  };

  if (account?.complimentary) return null;
  return (
    <div className="voice-packs">
      {params.get("voices") === "bought" && (
        <p className="goal-hint" role="status">
          <Icon name="check" size={15} /> {t("Thanks! Your hours are added as soon as the payment goes through.")}
        </p>
      )}
      {running.length > 0 && (
        <p className="goal-hint">
          {t("{time} left in hours you bought, used after the plan's own. The first ends on {date}.", {
            time: hoursAndMinutes(extra),
            date: when(running[0].expiresAt),
          })}
        </p>
      )}
      <div className="voice-pack-buttons">
        {VOICE_PACK_HOURS.map((hours) => (
          <button key={hours} type="button" className="secondary-button small-button" disabled={!allowed || busy !== null} onClick={() => void buy(hours)}>
            {busy === hours ? t("Opening the payment page…") : t("Buy {hours} more hours for {price}", { hours, price: packPrice(hours) })}
          </button>
        ))}
      </div>
      <p className="goal-hint">
        {allowed
          ? t("Paid once, not a subscription. Bought hours last 12 months and are used only when the month's plan hours run out. No refunds.")
          : t("More hours can be bought once your membership is paid for and active.")}
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </div>
  );
}
