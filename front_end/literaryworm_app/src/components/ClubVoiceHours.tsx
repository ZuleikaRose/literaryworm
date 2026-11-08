import { useEffect, useId, useState } from "react";
import { isUploadClub, type Club } from "../lib/clubs";
import { myClubVoiceUse } from "../lib/clubsApi";
import { CLUB_VOICE_MINUTES, clubVoiceLeft } from "../lib/clubVoice";
import { naturalVoiceMonth } from "../lib/naturalVoice";
import { hoursAndMinutes } from "../lib/planLimits";
import { useClubs } from "../lib/useClubs";
import { useT } from "../lib/useT";

/**
 * *Natural-voice hours* on the page of a club reading an uploaded book (lib/clubVoice.ts): the owner
 * gives each member some minutes a month from their own natural-voice reading, used only after a
 * member's own hours run out; members see the gift and what they've used of it this month.
 */
export function ClubVoiceHours({ club, isOwner, ownerName }: { club: Club; isOwner: boolean; ownerName: string }) {
  const t = useT();
  const clubs = useClubs();
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(club.voiceMinutesPerMember ?? null);
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!clubs.remote || isOwner || !minutes) return;
    let live = true;
    myClubVoiceUse(club.id, naturalVoiceMonth(new Date())).then(
      (characters) => live && setUsed(characters),
      // The gift still shows without it.
      (err: Error) => console.error("club voice hours: couldn't read this month's use:", err.message),
    );
    return () => {
      live = false;
    };
  }, [clubs.remote, club.id, isOwner, minutes]);

  if (!isUploadClub(club) || club.buddy) return null;
  const left = clubVoiceLeft(minutes, used);

  const choose = async (value: number | null) => {
    const before = minutes;
    setMinutes(value);
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      await clubs.setVoiceHours(club.id, value);
      setSaved(value ? t("Saved. Each member can have {time} a month.", { time: hoursAndMinutes(value * 60) }) : t("Saved. No hours are given."));
    } catch (err) {
      setMinutes(before);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="goal-card club-voice-hours" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Natural-voice hours")}</h2>
      {isOwner ? (
        <>
          <label className="field">
            <span className="field-label">{t("Give each member a month")}</span>
            <select
              className="field-input"
              value={minutes ?? ""}
              disabled={busy}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              onChange={(e) => void choose(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("None")}</option>
              {CLUB_VOICE_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {hoursAndMinutes(m * 60)}
                </option>
              ))}
            </select>
          </label>
          <p className="goal-hint" id={`${id}-hint`}>
            {t("Taken from your own month's natural-voice reading, and only when a member's own hours run out, for their copy of this book.")}
          </p>
        </>
      ) : left ? (
        <>
          <p>{t("{name} gives each member {time} a month of natural voices for this book, after your own hours.", { name: ownerName, time: hoursAndMinutes((minutes ?? 0) * 60) })}</p>
          {clubs.remote && <p className="goal-hint">{t("Used this month: {time}.", { time: hoursAndMinutes(left.used * 60) })}</p>}
        </>
      ) : (
        <p className="goal-hint">{t("The club's owner can give members natural-voice hours for this book.")}</p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {saved}
      </p>
    </section>
  );
}
