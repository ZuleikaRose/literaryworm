import { useEffect } from "react";
import { useStore } from "../store/context";
import { clearCount, sprintCount, useSprintCount } from "./sprintCounter";
import { pagesToSave } from "./sprints";
import * as sprintsApi from "./sprintsApi";
import { saveDemoPages } from "./useReadingSprint";

/**
 * Saves this device's sprint pages the moment the sprint ends, wherever the reader is in the app
 * (above the routes, in AppEffects). Members' go to Supabase (retried a few times); the demo's stay in memory.
 */
export function useSprintSaver() {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const count = useSprintCount();
  const sprintId = count?.sprintId;
  const endsAt = count?.endsAt;

  useEffect(() => {
    if (!sprintId || endsAt === undefined) return;
    let stopped = false;
    let timer = 0;
    const save = async (tries: number) => {
      // The count as it is now: pages keep adding up until the sprint ends.
      const c = sprintCount();
      if (stopped || !c || c.sprintId !== sprintId) return;
      const pages = pagesToSave(c.pages);
      try {
        if (remote) await sprintsApi.finishSprint(c.sprintId, c.profileId, pages);
        else saveDemoPages(c.sprintId, c.profileId, pages);
        clearCount(c.sprintId);
      } catch (err) {
        if (tries < 4) timer = window.setTimeout(() => void save(tries + 1), 5000 * (tries + 1));
        else {
          console.error("sprint: couldn't save pages:", err instanceof Error ? err.message : err);
          clearCount(c.sprintId);
        }
      }
    };
    timer = window.setTimeout(() => void save(0), Math.max(0, endsAt - Date.now()) + 500);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [sprintId, endsAt, remote]);
}
