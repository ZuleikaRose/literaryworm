import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { PlayerSettings } from "../types";
import * as accountApi from "./accountApi";

/** A volume drag sends many changes; members' settings save once it settles. */
const SAVE_AFTER_MS = 600;

/**
 * The active profile's player settings (volume, mute, skip lengths, skipping intros and outros).
 * Changes show at once; real accounts save them to the profile in the background, like recent
 * searches: losing one is no reason to interrupt listening.
 */
export function usePlayerSettings() {
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
    accountApi.savePlayerSettings(p.profileId, p.player).catch(() => {
      // Kept for this visit; the next change tries again.
    });
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  // A change waiting to save still saves when the control goes away.
  useEffect(() => () => flushRef.current(), []);

  function update(patch: Partial<PlayerSettings>) {
    dispatch({ type: "updatePlayerSettings", patch });
    if (!remote || !profileId) return;
    if (pending.current && pending.current.profileId !== profileId) flush();
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = { timer: window.setTimeout(flush, SAVE_AFTER_MS), profileId, player: { ...player, ...(pending.current?.player ?? {}), ...patch } };
  }

  return { player, update, toggleMute: () => update({ muted: !player.muted }) };
}
