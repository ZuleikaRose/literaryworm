import { useEffect } from "react";
import { useActiveProfile, useStore } from "../store/context";
import { today } from "./reading";
import { addBedtimeSeconds } from "./readingActivity";

/** How often Bedtime listening's time is added up while it plays. */
const STEP_MS = 30_000;

/**
 * Counts a Kids profile's time in Bedtime listening while it plays, for the Kids reading report
 * (ReadingDay.bedtimeListened; members' reading_days.bedtime_minutes through record_bedtime()).
 * Other profiles' time isn't kept.
 */
export function useBedtimeTime(playing: boolean): void {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const profileId = profile?.ageRating === "kids" ? profile.id : null;
  const remote = Boolean(state.account?.userId);
  useEffect(() => {
    if (!playing || !profileId) return;
    let last = Date.now();
    const add = () => {
      const now = Date.now();
      const seconds = Math.round((now - last) / 1000);
      last = now;
      if (seconds <= 0) return;
      const day = today();
      dispatch({ type: "addBedtimeListening", day, seconds, profileId });
      if (remote) addBedtimeSeconds(profileId, day, seconds, "bedtime");
    };
    const id = window.setInterval(add, STEP_MS);
    return () => {
      window.clearInterval(id);
      add();
    };
  }, [playing, profileId, remote, dispatch]);
}
