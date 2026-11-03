import { useEffect, useId, useState } from "react";
import { readNote, writeNote } from "../lib/offline";
import {
  announceScheduleChange,
  type ConnectionInfo,
  DEFAULT_SCHEDULE,
  knowsConnectionType,
  type ListenSchedule as Schedule,
  parseSchedule,
  SCHEDULE_CHANGED,
  SCHEDULE_CHAPTERS,
  schedulePath,
} from "../lib/offlineSchedule";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * *Listen offline on a schedule* inside Read offline (lib/offlineSchedule.ts): keep the next
 * chapters of this audiobook on this device as it plays, on Wi-Fi only if chosen, removing played
 * ones if chosen. `claimPlace` takes the device's offline place first (members); it resolves false
 * when the plan's places are full (Read offline then shows what to free).
 */
export function ListenSchedule({ bookId, claimPlace }: { bookId: string; claimPlace: (schedule: Schedule) => Promise<boolean> }) {
  const t = useT();
  const id = useId();
  const [saved, setSaved] = useState<Schedule | null | undefined>(undefined);
  const [draft, setDraft] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const known = knowsConnectionType((navigator as Navigator & { connection?: ConnectionInfo }).connection);

  // Read the saved schedule, and again when one is saved elsewhere (after freeing an offline place).
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    const changed = (e: Event) => (e as CustomEvent<string>).detail === bookId && setChanges((n) => n + 1);
    window.addEventListener(SCHEDULE_CHANGED, changed);
    return () => window.removeEventListener(SCHEDULE_CHANGED, changed);
  }, [bookId]);

  useEffect(() => {
    let live = true;
    readNote(schedulePath(bookId)).then(
      (raw) => {
        if (!live) return;
        const s = parseSchedule(raw);
        setSaved(s);
        if (s) setDraft(s);
      },
      () => live && setSaved(null),
    );
    return () => {
      live = false;
    };
  }, [bookId, changes]);

  if (saved === undefined) return null;
  const nextChapters = (n: number) => (n === 1 ? t("the next chapter") : t("the next {n} chapters", { n }));
  const wifiText = t(", on Wi-Fi only");

  async function save(next: Schedule | null) {
    setError(null);
    try {
      if (next && !(await claimPlace(next))) return;
      await writeNote(schedulePath(bookId), next);
      announceScheduleChange(bookId);
      setSaved(next);
      setStatus(
        next
          ? t("Keeping {chapters} on this device as you listen{wifi}.", { chapters: nextChapters(next.chapters), wifi: next.wifiOnly ? wifiText : "" })
          : t("Scheduled downloads are off for this book."),
      );
    } catch {
      setError(t("We couldn't save that on this device. Try again."));
    }
  }

  return (
    <fieldset className="listen-schedule">
      <legend>{t("Listen offline on a schedule")}</legend>
      <p className="field-hint">
        {t("As you listen, this device keeps the chapter you're on and the next ones, so the next part is there without a connection.")}
      </p>
      <div className="listen-schedule-row">
        <label htmlFor={`${id}-chapters`}>{t("Keep")}</label>
        <select id={`${id}-chapters`} className="field-input" value={draft.chapters} onChange={(e) => setDraft({ ...draft, chapters: Number(e.target.value) })}>
          {SCHEDULE_CHAPTERS.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? t("the chapter I'm on") : t("the next {n} chapters", { n })}
            </option>
          ))}
        </select>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={draft.wifiOnly} onChange={(e) => setDraft({ ...draft, wifiOnly: e.target.checked })} /> {t("On Wi-Fi only")}
      </label>
      {draft.wifiOnly && !known && (
        <p className="field-hint">{t("This browser doesn't say what kind of connection it's on, so it downloads whenever it's online (never with Data Saver on).")}</p>
      )}
      <label className="checkbox-row">
        <input type="checkbox" checked={draft.removePlayed} onChange={(e) => setDraft({ ...draft, removePlayed: e.target.checked })} /> {t("Remove chapters I've finished, to save space")}
      </label>
      <div className="listen-schedule-actions">
        <button type="button" className="secondary-button" onClick={() => save(draft)}>
          <Icon name="download" size={16} /> {saved ? t("Save the schedule") : t("Turn on")}
        </button>
        {saved && (
          <button type="button" className="text-button" onClick={() => save(null)}>
            {t("Turn off")}
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <p className={saved ? "goal-hint" : "visually-hidden"} role="status">
        {status ||
          (saved
            ? t("On: {chapters}{wifi}{removing}.", { chapters: nextChapters(saved.chapters), wifi: saved.wifiOnly ? wifiText : "", removing: saved.removePlayed ? t(", removing finished ones") : "" })
            : "")}
      </p>
    </fieldset>
  );
}
