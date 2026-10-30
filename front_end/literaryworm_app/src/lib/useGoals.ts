import { useProfileData, useActiveProfile, useStore } from "../store/context";
import * as accountApi from "./accountApi";

/**
 * The active profile's reading goals and days. Members save a goal to Supabase first, then the
 * store, so a failed save changes nothing and rejects with an AccountError for the page to show.
 */
export function useGoals() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const remote = Boolean(state.account?.userId);

  async function setGoal(year: number, books: number | null) {
    if (!profile) return;
    if (remote) await accountApi.setReadingGoal(profile.id, year, books);
    dispatch({ type: "setReadingGoal", year, books });
  }

  /** The profile's own weekly goal in minutes (not for Kids profiles: a grown-up sets theirs). */
  async function setWeeklyGoal(minutes: number | null) {
    if (!profile || profile.ageRating === "kids") return;
    if (remote) await accountApi.setWeeklyGoal(profile.id, minutes);
    dispatch({ type: "updateProfile", id: profile.id, patch: { weeklyGoalMinutes: minutes } });
  }

  return { goals: data.readingGoals, days: data.readingDays, setGoal, setWeeklyGoal };
}
