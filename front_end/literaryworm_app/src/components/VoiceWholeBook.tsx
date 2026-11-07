import { useEffect, useId, useRef, useState } from "react";
import { readingTime } from "../lib/goals";
import { bookText, resolveNarration } from "../lib/narration";
import { defaultNaturalVoice, type NaturalVoice } from "../lib/naturalVoice";
import { memberVoicePart } from "../lib/naturalVoiceOffline";
import { connectionAllows, type ConnectionInfo } from "../lib/offlineSchedule";
import { useNaturalVoice, useNaturalVoiceUsage } from "../lib/useNaturalVoice";
import { useT } from "../lib/useT";
import { fitsAllowance, wholeBookPlan, type WholeBookPlan } from "../lib/voiceWholeBook";
import { useProfileData } from "../store/context";
import type { Book } from "../types";
import { Icon } from "./Icon";

type Run = { kind: "idle" } | { kind: "running"; done: number } | { kind: "done" } | { kind: "stopped"; done: number; message: string | null };

/**
 * *Voice the whole book* on an upload's page: every part voiced by the profile's natural voice
 * (with character voices if they're on) and kept on this device for listening offline, on Wi-Fi.
 * Members only; the demo explains it, since its sample is already voiced.
 */
export function VoiceWholeBook({ book }: { book: Book }) {
  const t = useT();
  const id = useId();
  const source = useNaturalVoice(book);
  const usage = useNaturalVoiceUsage();
  const { narrationVoice, player } = useProfileData();
  const narration = resolveNarration(book, narrationVoice, [], true);
  const narrator: NaturalVoice = narration.kind === "natural" ? narration.voice : defaultNaturalVoice(book.language);
  const [chapters, setChapters] = useState<string[] | null>(null);
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const stop = useRef(false);

  useEffect(() => {
    if (source !== "member") return;
    let live = true;
    bookText(book).then(
      (text) => live && setChapters(text),
      () => undefined,
    );
    return () => {
      live = false;
      stop.current = true;
    };
  }, [book, source]);

  if (source === null) return null;
  if (source === "demo") {
    return (
      <section className="goal-card voice-whole-book" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{t("Voice the whole book")}</h2>
        <p className="field-hint">{t("Members can have a natural voice read a whole upload ahead and keep it on their device for listening offline. The demo's sample is already voiced.")}</p>
      </section>
    );
  }
  if (!chapters) return null;

  const plan: WholeBookPlan = wholeBookPlan(chapters, narrator, player.characterVoices);
  const fits = fitsAllowance(plan, usage ? usage.left : null);

  const start = async () => {
    const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
    if (!navigator.onLine || !connectionAllows(connection, { wifiOnly: true })) {
      setRun({ kind: "stopped", done: 0, message: t("Connect to Wi-Fi (with Data Saver off) to voice the whole book.") });
      return;
    }
    stop.current = false;
    const part = memberVoicePart(book.id, narrator, chapters, player.characterVoices, player.castChoices?.[book.id] ?? {});
    let done = 0;
    setRun({ kind: "running", done });
    for (const [c, s] of plan.parts) {
      if (stop.current) {
        setRun({ kind: "stopped", done, message: null });
        return;
      }
      try {
        await part.keep(c, s);
      } catch (err) {
        setRun({ kind: "stopped", done, message: err instanceof Error ? err.message : t("We couldn't voice the rest. Try again later.") });
        return;
      }
      done += 1;
      setRun({ kind: "running", done });
    }
    setRun({ kind: "done" });
  };

  const total = plan.parts.length;
  return (
    <section className="goal-card voice-whole-book" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Voice the whole book")}</h2>
      <p className="field-hint">
        {t("{voice} reads every part now and keeps it on this device, so you can listen offline. On Wi-Fi only.", { voice: narrator.name })}{" "}
        {t("The book is about {time} of new natural-voice reading at most; parts already voiced don't count.", { time: readingTime(Math.round(plan.hours * 3600)) })}
        {usage && ` ${t("You have {time} left this month.", { time: readingTime(Math.round(usage.left)) })}`}
      </p>
      {fits === false && <p className="field-hint">{t("It may not all fit this month. It stops when the month's reading is used up, and the rest can wait.")}</p>}
      {run.kind === "running" ? (
        <>
          <progress className="goal-bar" max={total} value={run.done} aria-label={t("Parts voiced")} />
          <p role="status">{t("{done} of {total} parts voiced", { done: run.done, total })}</p>
          <button type="button" className="secondary-button small-button" onClick={() => (stop.current = true)}>
            {t("Stop")}
          </button>
        </>
      ) : (
        <>
          {run.kind === "done" && <p role="status">{t("Every part is voiced and kept on this device.")}</p>}
          {run.kind === "stopped" && (
            <p role="status">
              {run.message ?? t("Stopped.")} {run.done > 0 && t("{done} of {total} parts voiced", { done: run.done, total })}
            </p>
          )}
          <button type="button" className="secondary-button" onClick={() => void start()} disabled={total === 0}>
            <Icon name="download" size={18} /> {run.kind === "idle" ? t("Voice the whole book") : t("Voice the rest")}
          </button>
        </>
      )}
    </section>
  );
}
