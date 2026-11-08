import { useEffect, useId, useRef, useState } from "react";
import { readingTime } from "../lib/goals";
import { bookText, resolveNarration } from "../lib/narration";
import { defaultNaturalVoice, type NaturalVoice } from "../lib/naturalVoice";
import { memberVoicePart } from "../lib/naturalVoiceOffline";
import { audiobookFileName, collectAudiobook, saveFile } from "../lib/audiobookExport";
import { demoVoicePart } from "../lib/demoVoices";
import { connectionAllows, type ConnectionInfo } from "../lib/offlineSchedule";
import { useNaturalVoice, useNaturalVoiceUsage } from "../lib/useNaturalVoice";
import { useT } from "../lib/useT";
import { storageSize } from "../lib/offlineVoices";
import { forgetVoicesOffline, voicesOnDevice } from "../lib/uploadCache";
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
  const [download, setDownload] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });

  useEffect(() => {
    if (source === null) return;
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
  const plan: WholeBookPlan | null = chapters ? wholeBookPlan(chapters, narrator, player.characterVoices) : null;
  const choices = player.castChoices?.[book.id] ?? {};

  /** Download the audiobook: every part joined into one MP3 (lib/audiobookExport.ts). */
  const saveAudiobook = async () => {
    if (!chapters || !plan) return;
    setDownload({ busy: true, message: null });
    try {
      const blobOf =
        source === "demo"
          ? (() => {
              // The demo's parts are recordings served with the site.
              const part = demoVoicePart(book.id, narrator, chapters, player.characterVoices, choices);
              return async (c: number, s: number) => {
                const res = await fetch(await part.url(c, s));
                return res.ok ? res.blob() : null;
              };
            })()
          : memberVoicePart(book.id, narrator, chapters, player.characterVoices, choices, player.pronunciations?.[book.id] ?? {}).keptBlob;
      const { blob, missing } = await collectAudiobook(plan.parts, blobOf);
      if (!blob) {
        setDownload({ busy: false, message: t.plural(missing, { one: "Voice the whole book first: {count} part isn't on this device yet.", other: "Voice the whole book first: {count} parts aren't on this device yet." }) });
        return;
      }
      saveFile(blob, audiobookFileName(book.title));
      setDownload({ busy: false, message: t("Saved. It plays in any audio app, from the start of the book.") });
    } catch {
      setDownload({ busy: false, message: t("We couldn't make the file. Try again.") });
    }
  };
  const downloadButton = plan && plan.parts.length > 0 && (
    <>
      <button type="button" className="secondary-button" onClick={() => void saveAudiobook()} disabled={download.busy}>
        <Icon name="download" size={18} /> {download.busy ? t("Making the file…") : t("Download the audiobook (MP3)")}
      </button>
      {download.message && <p role="status">{download.message}</p>}
    </>
  );

  if (source === "demo") {
    return (
      <section className="goal-card voice-whole-book" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{t("Voice the whole book")}</h2>
        <p className="field-hint">{t("Members can have a natural voice read a whole upload ahead and keep it on their device for listening offline. The demo's sample is already voiced.")}</p>
        <p className="field-hint">{t("Once every part is voiced, you can save the whole audiobook as one MP3 to play in any audio app.")}</p>
        {downloadButton}
      </section>
    );
  }
  if (!chapters || !plan) return null;

  const fits = fitsAllowance(plan, usage ? usage.left : null);

  const start = async () => {
    const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
    if (!navigator.onLine || !connectionAllows(connection, { wifiOnly: true })) {
      setRun({ kind: "stopped", done: 0, message: t("Connect to Wi-Fi (with Data Saver off) to voice the whole book.") });
      return;
    }
    stop.current = false;
    const part = memberVoicePart(book.id, narrator, chapters, player.characterVoices, player.castChoices?.[book.id] ?? {}, player.pronunciations?.[book.id] ?? {});
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
      <p className="field-hint">{t("Once every part is voiced, you can save the whole audiobook as one MP3 to play in any audio app.")}</p>
      {downloadButton}
      <OnThisDevice uploadId={book.id} refresh={run.kind === "running" ? -1 : run.kind === "idle" ? 0 : 1} />
    </section>
  );
}

/**
 * *On this device*: how many of the upload's voiced parts are kept here and how much space they
 * take (lib/offlineVoices.ts), so it's clear a book is ready before a trip, and *Remove the voices
 * from this device* after. The text stays; parts can be voiced or played again online.
 */
function OnThisDevice({ uploadId, refresh }: { uploadId: string; refresh: number }) {
  const t = useT();
  const [kept, setKept] = useState<{ parts: number; bytes: number } | null>(null);
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (refresh < 0) return;
    let live = true;
    voicesOnDevice(uploadId).then(
      (found) => live && setKept(found),
      () => live && setKept(null),
    );
    return () => {
      live = false;
    };
  }, [uploadId, refresh]);

  const remove = async () => {
    setRemoving(true);
    try {
      await forgetVoicesOffline(uploadId);
      setKept({ parts: 0, bytes: 0 });
      setStatus(t("Removed from this device. The book's text stays, and the voices play again online."));
    } catch {
      setStatus(t("We couldn't remove them. Try again."));
    } finally {
      setRemoving(false);
    }
  };

  if (!kept) return null;
  return (
    <div className="voices-on-device">
      <h3>{t("On this device")}</h3>
      <p>
        {kept.parts === 0
          ? t("No voiced parts are kept here yet.")
          : t.plural(kept.parts, { one: "{count} voiced part, {size}", other: "{count} voiced parts, {size}" }, { size: storageSize(kept.bytes) })}
      </p>
      {kept.parts > 0 && (
        <button type="button" className="ghost-button small-button" onClick={() => void remove()} disabled={removing}>
          <Icon name="trash" size={15} /> {t("Remove the voices from this device")}
        </button>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </div>
  );
}
