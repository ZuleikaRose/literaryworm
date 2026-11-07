import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { PlayerSettings } from "../types";
import * as accountApi from "./accountApi";
import { hasOwnSpeed, speedFor, speedPatch, withBookSpeed } from "./bookSpeed";

/** A volume drag sends many changes; members' settings save once it settles. */
const SAVE_AFTER_MS = 600;

/**
 * The active profile's player settings (speed, volume, mute, skip lengths, skipping intros and outros).
 * Changes show at once; real accounts save them to the profile in the background, like recent
 * searches: losing one is no reason to interrupt listening.
 */
export function usePlayerSettings(bookId: string | null = null) {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const { player } = useProfileData();
  const remote = Boolean(state.account?.userId);
  const profileId = profile?.id ?? null;

  const pending = useRef<{ timer: number; profileId: string; player: PlayerSettings } | null>(null);
  const flush = () => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    accountApi.savePlayerSettings(p.profileId, p.player).catch((err: Error) => {
      // Kept for this visit; the next change tries again.
      console.error("player settings: couldn't save:", err.message);
    });
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  // A change waiting to save still saves when the control goes away.
  useEffect(() => () => flushRef.current(), []);

  function update(change: Partial<PlayerSettings>) {
    // A speed change while a book with its own speed is open changes that book's speed only.
    const patch = change.speed !== undefined ? { ...change, ...speedPatch(player, bookId, change.speed) } : change;
    if (patch.bookSpeeds && change.speed !== undefined) delete patch.speed;
    dispatch({ type: "updatePlayerSettings", patch });
    if (!remote || !profileId) return;
    if (pending.current && pending.current.profileId !== profileId) flush();
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = { timer: window.setTimeout(flush, SAVE_AFTER_MS), profileId, player: { ...player, ...(pending.current?.player ?? {}), ...patch } };
  }

  return {
    /** The settings, with `speed` the open book's own speed when it has one. */
    player: { ...player, speed: speedFor(player, bookId) },
    update,
    toggleMute: () => update({ muted: !player.muted }),
    /** Whether the open book keeps its own speed, and a way to start or stop that. */
    ownSpeed: hasOwnSpeed(player, bookId),
    setOwnSpeed: (on: boolean) => {
      if (bookId) update({ bookSpeeds: withBookSpeed(player.bookSpeeds, bookId, on ? speedFor(player, bookId) : null) });
    },
  };
}
