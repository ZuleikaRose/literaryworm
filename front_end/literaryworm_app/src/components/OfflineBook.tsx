import { useEffect, useState } from "react";
import { planById } from "../data/plans";
import { freeOfflineDevice, type OfflineDevice } from "../lib/accountApi";
import { audioMegabytes, offlineState, type OfflineState, offlineSupported, removeOffline, saveOffline } from "../lib/offline";
import { takeOfflinePlace } from "../lib/offlinePlaces";
import { useStore } from "../store/context";
import type { Book, PlanId } from "../types";
import { Icon } from "./Icon";

/** The plan's offline places are all taken: which plan, and the devices holding them. */
interface PlacesFull {
  planId: PlanId;
  limit: number;
  devices: OfflineDevice[];
  /** What was being saved, so freeing a place carries on with it. */
  withAudio: boolean;
}

/**
 * Book page, public-domain titles: save the text (and the audio, if wanted) on this device for
 * reading and listening without a connection, or remove it again.
 */
export function OfflineBook({ book }: { book: Book }) {
  const [state, setState] = useState<OfflineState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [full, setFull] = useState<PlacesFull | null>(null);
  const userId = useStore().state.account?.userId ?? null;

  useEffect(() => {
    let live = true;
    offlineState(book).then(
      (s) => live && setState(s),
      () => live && setState(null),
    );
    return () => {
      live = false;
    };
  }, [book, version]);

  if (!offlineSupported()) return null;

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setFull(null);
    try {
      // The reader and player load on first use; load them now so the service worker keeps them too.
      await Promise.all([import("../pages/Reader"), import("../pages/Player")]);
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
      setVersion((n) => n + 1);
    }
  };

  /** Members' devices each hold one of the plan's offline places; saving needs one. */
  const save = (withAudio: boolean, progress?: (done: number, total: number) => void) => async () => {
    if (userId) {
      const claim = await takeOfflinePlace(userId);
      if (claim.status === "full") {
        setFull({ ...claim, withAudio });
        return;
      }
    }
    await saveOffline(book, withAudio, progress);
  };

  const free = (device: OfflineDevice, withAudio: boolean) =>
    run(`Freeing ${device.label}…`, async () => {
      await freeOfflineDevice(device.id);
      await save(withAudio, (done, total) => setBusy(`Saving the audio: chapter ${done} of ${total}…`))();
    });

  const megabytes = audioMegabytes(book);
  const audioSaved = state !== null && state.tracks > 0 && state.audio === state.tracks;
  const saved = state?.text ?? false;

  return (
    <section className="offline-book" aria-labelledby="offline-title">
      <h2 id="offline-title">Read offline</h2>
      <p className="goal-hint" role="status">
        {busy ??
          (saved
            ? audioSaved
              ? "The text and audio are saved on this device."
              : "The text is saved on this device; a voice can read it aloud offline too."
            : "Save this book on this device to read it without a connection.")}
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {full && (
        <div className="offline-full" role="alert">
          <p>
            Your {planById.get(full.planId)?.name ?? "Basic"} plan keeps offline books on {full.limit} {full.limit === 1 ? "device" : "devices"}, and{" "}
            {full.limit === 1 ? "it's" : "they're all"} in use. Free one to use this device instead; its offline books are removed the next time it opens LiteraryWorm.
          </p>
          <ul role="list">
            {full.devices.map((d) => (
              <li key={d.id}>
                <span>
                  {d.label}
                  <span className="muted"> · last used {new Date(d.lastSeenAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
                </span>
                <button type="button" className="ghost-button small-button" disabled={busy !== null} onClick={() => free(d, full.withAudio)}>
                  Free<span className="visually-hidden"> {d.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="goal-actions">
        {!saved && (
          <button type="button" className="ghost-button small-button" disabled={busy !== null} onClick={() => run("Saving the text…", save(false))}>
            <Icon name="download" size={15} /> Save the text (small)
          </button>
        )}
        {!audioSaved && state !== null && state.tracks > 0 && (
          <button
            type="button"
            className="ghost-button small-button"
            disabled={busy !== null}
            onClick={() => run("Saving the audio…", save(true, (done, total) => setBusy(`Saving the audio: chapter ${done} of ${total}…`)))}
          >
            <Icon name="headphones" size={15} /> {saved ? "Add the audio" : "Save text and audio"} (about {megabytes} MB)
          </button>
        )}
        {(saved || (state?.audio ?? 0) > 0) && (
          <button type="button" className="ghost-button small-button" disabled={busy !== null} onClick={() => run("Removing…", () => removeOffline(book))}>
            <Icon name="trash" size={15} /> Remove from this device
          </button>
        )}
      </div>
    </section>
  );
}
