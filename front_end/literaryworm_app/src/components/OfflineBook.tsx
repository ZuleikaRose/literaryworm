import { useEffect, useState } from "react";
import { audioMegabytes, offlineState, type OfflineState, offlineSupported, removeOffline, saveOffline } from "../lib/offline";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * Book page, public-domain titles: save the text (and the audio, if wanted) on this device for
 * reading and listening without a connection, or remove it again.
 */
export function OfflineBook({ book }: { book: Book }) {
  const [state, setState] = useState<OfflineState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

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
      <div className="goal-actions">
        {!saved && (
          <button type="button" className="ghost-button small-button" disabled={busy !== null} onClick={() => run("Saving the text…", () => saveOffline(book, false))}>
            <Icon name="download" size={15} /> Save the text (small)
          </button>
        )}
        {!audioSaved && state !== null && state.tracks > 0 && (
          <button
            type="button"
            className="ghost-button small-button"
            disabled={busy !== null}
            onClick={() => run("Saving the audio…", () => saveOffline(book, true, (done, total) => setBusy(`Saving the audio: chapter ${done} of ${total}…`)))}
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
