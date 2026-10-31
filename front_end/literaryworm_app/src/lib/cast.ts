import { useSyncExternalStore } from "react";

/**
 * Listen on a speaker or TV: the browser's own Remote Playback API (Chromecast in Chrome,
 * AirPlay in Safari) on the LibriVox recording's audio element. No third-party script loads;
 * the browser shows its own device picker. The recording narrator registers its element here
 * (lib/narration.ts); device voices can't be cast, since the device itself speaks.
 */
export interface CastState {
  /** A device to cast to was found (or the browser can't tell, but can prompt). */
  available: boolean;
  connected: boolean;
  connecting: boolean;
}

const idle: CastState = { available: false, connected: false, connecting: false };
let media: HTMLMediaElement | null = null;
let state: CastState = idle;
let watchId: number | null = null;
const listeners = new Set<() => void>();

const emit = (next: Partial<CastState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export const castSupported = () => typeof HTMLMediaElement !== "undefined" && "remote" in HTMLMediaElement.prototype;

/** Called with the recording's audio element when a book opens, and null when it closes. */
export function setCastMedia(el: HTMLMediaElement | null) {
  if (media === el) return;
  const old = media;
  if (old?.remote && watchId !== null) old.remote.cancelWatchAvailability(watchId).catch(() => undefined);
  watchId = null;
  media = el;
  state = idle;
  if (el && castSupported()) {
    const remote = el.remote;
    remote.onconnecting = () => emit({ connecting: true });
    remote.onconnect = () => emit({ connected: true, connecting: false });
    remote.ondisconnect = () => emit({ connected: false, connecting: false });
    remote
      .watchAvailability((available) => emit({ available }))
      .then((id) => {
        watchId = id;
      })
      // Some browsers can't watch (to save battery) but can still show their picker.
      .catch(() => emit({ available: true }));
  }
  listeners.forEach((l) => l());
}

/** Opens the browser's device picker. Rejects if the listener closes it without choosing. */
export function startCast(): Promise<void> {
  if (!media || !castSupported()) return Promise.reject(new Error("Nothing to cast"));
  return media.remote.prompt();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCast(): CastState {
  return useSyncExternalStore(subscribe, () => state, () => idle);
}
