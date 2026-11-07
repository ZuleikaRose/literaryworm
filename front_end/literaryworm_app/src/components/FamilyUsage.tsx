import { useEffect, useId, useState } from "react";
import { usesBackend } from "../lib/backend";
import { familyUsage } from "../lib/familyUsage";
import { naturalVoiceByProfile } from "../lib/naturalVoiceApi";
import { CHARACTERS_PER_HOUR, naturalVoiceMonth } from "../lib/naturalVoice";
import { hoursAndMinutes } from "../lib/planLimits";
import { today } from "../lib/reading";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";

/**
 * *This month's listening* in Account → Family (lib/familyUsage.ts): each profile's audiobook
 * listening and new natural-voice reading this month, so the grown-ups see where the plan's hours
 * go. The demo shows Avery with 40 minutes of natural voices.
 */
export function FamilyUsage() {
  const t = useT();
  const id = useId();
  const { state } = useStore();
  const demo = Boolean(state.account?.isDemo);
  const member = usesBackend && Boolean(state.account?.userId);
  const [loaded, setLoaded] = useState<Record<string, number> | null>(null);
  const firstProfile = state.profiles[0]?.id;

  useEffect(() => {
    if (demo || !member) return;
    let live = true;
    naturalVoiceByProfile(naturalVoiceMonth(new Date())).then(
      (rows) => live && setLoaded(rows),
      // The listening still shows without it.
      (err: Error) => (console.error("family report: couldn't read natural voice use:", err.message), live && setLoaded({})),
    );
    return () => {
      live = false;
    };
  }, [demo, member]);
  // The demo's sample: Avery has had 40 minutes voiced.
  const natural = demo ? (firstProfile ? { [firstProfile]: Math.round((CHARACTERS_PER_HOUR * 40) / 60) } : {}) : loaded;

  if (state.profiles.length === 0) return null;
  const rows = familyUsage(state.profiles, state.profileData, natural ?? {}, today().slice(0, 7));
  const showNatural = demo || member;
  return (
    <section className="family-usage" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("This month's listening")}</h3>
      <p className="field-hint">{t("Audiobook listening and new natural-voice reading for each profile, so you can see where the plan's hours go.")}</p>
      <table className="family-usage-table">
        <thead>
          <tr>
            <th scope="col">{t("Profile")}</th>
            <th scope="col">{t("Audiobooks")}</th>
            {showNatural && <th scope="col">{t("Natural voices")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profileId}>
              <th scope="row">{r.name}</th>
              <td>{hoursAndMinutes(r.listened)}</td>
              {showNatural && <td>{natural === null ? "…" : hoursAndMinutes(r.natural)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
