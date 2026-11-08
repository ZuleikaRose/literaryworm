import { useEffect, useMemo, useState } from "react";
import { DEMO_NATURAL_SAMPLES } from "../data/demoUploads";
import { useActiveProfile, useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { naturalVoiceMonth, naturalVoiceOffered, naturalVoiceTime } from "./naturalVoice";
import { naturalVoicePacks, naturalVoiceUsage } from "./naturalVoiceApi";
import { packSecondsLeft, type VoicePack } from "./voicePacks";

/**
 * Where this book's natural voices come from for the active profile: "member" (a member's stored
 * upload, voiced by the natural-voice function), "demo" (the demo's Frankenstein and Tide Clock samples, recorded
 * in public/voices/demo), or null (not offered: other books, Kids profiles, the demo's other uploads).
 */
export function useNaturalVoice(book: Book): "member" | "demo" | null {
  const { state } = useStore();
  const profile = useActiveProfile();
  const ageRating = profile?.ageRating ?? null;
  if (naturalVoiceOffered({ member: usesBackend && Boolean(state.account?.userId), ageRating, uploadPath: book.upload?.path ?? null, kidsAllowed: profile?.kidsNaturalVoices })) return "member";
  if (state.account?.isDemo && book.upload && DEMO_NATURAL_SAMPLES.includes(book.id) && ageRating !== null && (ageRating !== "kids" || Boolean(profile?.kidsNaturalVoices))) return "demo";
  return null;
}

/**
 * This month's new natural-voice reading for a member's account (Account → This month, the bell):
 * seconds used and left of the plan's allowance, and when 80% was passed. Null for in-memory
 * accounts and Kids profiles, or until it loads.
 */
/**
 * `left` includes what's left in bought packs (`extra`, seconds; lib/voicePacks.ts), which are
 * used once the plan's hours are.
 */
export function useNaturalVoiceUsage(): { used: number; left: number; limit: number; extra: number; packs: VoicePack[]; mostlyUsedAt: number | null; trial: boolean; paused: boolean } | null {
  const { state } = useStore();
  const profile = useActiveProfile();
  const planId = state.account?.planId ?? null;
  // The free week has its one hour; a failed payment pauses natural voices until one goes through.
  const trialUntil = state.account?.trialUntil ?? null;
  const trial = trialUntil !== null && Date.parse(trialUntil) > Date.now();
  const paused = Boolean(state.account?.pastDue);
  const member = usesBackend && Boolean(state.account?.userId) && (profile?.ageRating !== "kids" || Boolean(profile?.kidsNaturalVoices)) && planId !== null;
  const [usage, setUsage] = useState<{ characters: number; mostlyUsedAt: string | null; packs: VoicePack[] } | null>(null);
  useEffect(() => {
    if (!member) return;
    let live = true;
    const look = () =>
      Promise.all([naturalVoiceUsage(naturalVoiceMonth(new Date())), naturalVoicePacks()]).then(
        ([u, packs]) => live && setUsage({ ...u, packs }),
        (err: Error) => console.error("natural voices: couldn't read this month's use:", err.message),
      );
    void look();
    // Listening on another device uses it too: look again when the tab comes back.
    const onVisible = () => document.visibilityState === "visible" && void look();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [member]);
  return useMemo(
    () => {
      if (!member || !usage || !planId) return null;
      const time = naturalVoiceTime(planId, usage.characters, trial);
      const extra = packSecondsLeft(usage.packs);
      return { ...time, extra, packs: usage.packs, left: paused ? 0 : time.left + extra, mostlyUsedAt: usage.mostlyUsedAt ? Date.parse(usage.mostlyUsedAt) : null, trial, paused };
    },
    [member, usage, planId, trial, paused],
  );
}
