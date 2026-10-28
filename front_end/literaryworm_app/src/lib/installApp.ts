import { useSyncExternalStore } from "react";

/**
 * Installing LiteraryWorm as an app (public/manifest.webmanifest). Chrome, Edge and Android
 * offer it through `beforeinstallprompt`, which can fire before React has drawn anything, so
 * this module listens from the moment it loads (main.tsx imports it). Safari has no prompt:
 * people add it from the Share menu, so the page says how.
 */

/** Chrome's install event (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "installed": already running as the app. "ready": the browser can install it now.
 * "safari": add it from the Share menu. "unavailable": this browser can't (or it's been turned down for now).
 */
export type InstallState = "installed" | "ready" | "safari" | "unavailable";

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for the Install button instead of the browser's own banner.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function current(): InstallState {
  if (installed || standalone()) return "installed";
  if (deferred) return "ready";
  // iPhone and iPad (every iOS browser is Safari underneath), and Safari on a Mac.
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "safari";
  if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(ua)) return "safari";
  return "unavailable";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether LiteraryWorm can be installed here, and `install()` to ask (resolves true if it was). */
export function useInstallApp() {
  const state = useSyncExternalStore(subscribe, current, () => "unavailable" as InstallState);
  const install = async (): Promise<boolean> => {
    const prompt = deferred;
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event can only be used once; the browser fires a new one if it can ask again.
    deferred = null;
    notify();
    return outcome === "accepted";
  };
  return { state, install };
}
