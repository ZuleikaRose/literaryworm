import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { today } from "./reading";

/** Time is added to the store in steps this long, so the whole app doesn't re-render every second. */
const STEP_SECONDS = 10;
export const EXTRA_MINUTES = 30;

/**
 * The profile's daily reading and listening limit (story 14). Counts time while `counting`
 * is true (the reader is open and the tab visible, or the player is playing) and reports
 * when today's time is used up. A grown-up can allow 30 more minutes with the account password.
 * `profileId` pins the counting to one profile (the mini-player), so time still lands on the
 * profile that was listening if someone switches profile while it plays.
 */
export function useDailyLimit(counting: boolean, profileId?: string) {
  const { dispatch } = useStore();
  const profile = useActiveProfile();
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
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      unsaved.current += 1;
      if (unsaved.current >= STEP_SECONDS) {
        dispatch({ type: "addTimeUsed", day: today(), seconds: unsaved.current, profileId });
        unsaved.current = 0;
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      if (unsaved.current > 0) {
        dispatch({ type: "addTimeUsed", day: today(), seconds: unsaved.current, profileId });
        unsaved.current = 0;
      }
    };
  }, [counting, reached, dispatch, profileId]);

  return {
    limitMinutes,
    remainingSeconds,
    reached,
    allowMore: () => dispatch({ type: "allowExtraTime", day: today(), minutes: EXTRA_MINUTES }),
  };
}
