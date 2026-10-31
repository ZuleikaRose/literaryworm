import { useCallback, useEffect, useState } from "react";
import { deviceIdFor } from "./deviceId";
import {
  claimHandoff,
  deviceLabel,
  HANDOFF_FRESH_MS,
  type Handoff,
  latestHandoff,
  registerDevice,
  touchDevice,
  watchHandoffs,
} from "./devicesApi";
import { supabase } from "./supabase";

/** How often an open device checks in while its tab is showing. */
const CHECK_IN_MS = 60_000;

/** Background device calls never interrupt listening; a failure is logged and the next check-in tries again. */
const logFailure = (what: string) => (err: Error) => console.error(`devices: couldn't ${what}:`, err.message);

/** This browser's id for each member signed in during the visit (kept across visits by `deviceIdFor()`). */
const deviceIds = new Map<string, string>();
const THIS_DEVICE = typeof navigator === "undefined" ? "This device" : deviceLabel();

/**
 * Makes this copy of the app one of a member's devices while they're signed in: it checks in
 * every minute (and when the tab comes back), and hears of books sent to it. Does nothing for
 * in-memory accounts. The playback provider turns this into `Playback.link`.
 */
export function useDeviceLink(userId: string | null) {
  const deviceId = userId && supabase ? (deviceIds.get(userId) ?? newDeviceId(userId)) : null;
  const [incoming, setIncoming] = useState<Handoff | null>(null);
  // A different member (or none) has nothing waiting from the last one (adjusting state during render).
  const [forDevice, setForDevice] = useState(deviceId);
  if (forDevice !== deviceId) {
    setForDevice(deviceId);
    setIncoming(null);
  }

  useEffect(() => {
    if (!deviceId) return;
    let live = true;
    const offer = (handoff: Handoff | null) => {
      if (live && handoff && Date.now() - handoff.createdAt < HANDOFF_FRESH_MS) setIncoming(handoff);
    };
    const check = () => latestHandoff(deviceId).then(offer, logFailure("check for books sent here"));
    registerDevice(deviceId, THIS_DEVICE).then(check, logFailure("add this device"));
    const stop = watchHandoffs(deviceId, offer);

    const checkIn = () => {
      if (document.visibilityState === "visible") touchDevice(deviceId).catch(logFailure("check in"));
    };
    const id = window.setInterval(checkIn, CHECK_IN_MS);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      checkIn();
      // Realtime can miss a message while a phone sleeps; look when the tab comes back.
      void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      stop();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deviceId]);

  /** Marks the waiting handoff dealt with (picked up or turned down). */
  const settle = useCallback(() => {
    if (incoming) claimHandoff(incoming.id).catch(logFailure("mark the book sent here as dealt with"));
    setIncoming(null);
  }, [incoming]);

  return { deviceId, thisDevice: THIS_DEVICE, incoming, settle };
}

function newDeviceId(userId: string): string {
  const id = deviceIdFor(userId);
  deviceIds.set(userId, id);
  return id;
}
