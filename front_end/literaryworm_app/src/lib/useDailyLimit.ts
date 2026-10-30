import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { addReadingSeconds } from "./readingActivity";
import { today } from "./reading";

/** Time is added to the store in steps this long, so the whole app doesn't re-render every second. */
const STEP_SECONDS = 10;
/** A computer that slept doesn't count the time it was asleep. */
const MAX_STEP_SECONDS = 120;
export const EXTRA_MINUTES = 30;

/**
 * The profile's daily reading and listening limit (story 14). Counts time while `counting`
 * is true (the reader is open and the tab visible, or the player is playing) and reports
 * when today's time is used up. A grown-up can allow 30 more minutes with the account password.
 * `profileId` pins the counting to one profile (the mini-player), so time still lands on the
 * profile that was listening if someone switches profile while it plays. `listening` counts the
 * time as listening rather than reading (for stats).
 */
export function useDailyLimit(counting: boolean, profileId?: string, listening = false) {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  // Members' reading time also goes to Supabase, for goals and streaks.
  const remote = Boolean(state.account?.userId);
  const countedProfile = profileId ?? profile?.id ?? null;
  const data = useProfileData();
  const day = today();
  const used = data.timeUsed.day === day ? data.timeUsed : { day, seconds: 0, extraMinutes: 0 };
  const limitMinutes = profile?.dailyLimitMinutes ?? null;
  const allowedSeconds = limitMinutes === null ? Infinity : (limitMinutes + used.extraMinutes) * 60;
  const remainingSeconds = Math.max(0, allowedSeconds - used.seconds);
  const reached = remainingSeconds <= 0;
  const unsaved = useRef(0);

  useEffect(() => {
    if (!counting || reached) return;
    const add = (seconds: number) => {
      const day = today();
      dispatch({ type: "addTimeUsed", day, seconds, profileId, listening });
      if (remote && countedProfile) addReadingSeconds(countedProfile, day, seconds, listening);
    };
    // Counted by the clock rather than by ticks: browsers slow timers in background tabs, and
    // listening carries on there (reading doesn't count while the tab is hidden).
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(MAX_STEP_SECONDS, Math.max(0, Math.round((now - last) / 1000)));
      if (elapsed === 0) return;
      last = now;
      if (!listening && document.visibilityState !== "visible") return;
      unsaved.current += elapsed;
      if (unsaved.current >= STEP_SECONDS) {
        add(unsaved.current);
        unsaved.current = 0;
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      if (unsaved.current > 0) {
        add(unsaved.current);
        unsaved.current = 0;
      }
    };
  }, [counting, reached, dispatch, profileId, remote, countedProfile, listening]);

  return {
    limitMinutes,
    remainingSeconds,
    reached,
    allowMore: () => dispatch({ type: "allowExtraTime", day: today(), minutes: EXTRA_MINUTES }),
  };
}
