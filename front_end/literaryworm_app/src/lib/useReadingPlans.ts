import { useCallback, useEffect, useState } from "react";
import { useProfileData, useStore } from "../store/context";
import type { ReadingPlan } from "../types";
import * as accountApi from "./accountApi";
import { PLANS_MAX } from "./readingPlans";

/**
 * The active profile's reading plans (lib/readingPlans.ts): members' from Supabase
 * (`reading_plans`, read when the page opens; saved first, then shown), in-memory accounts' from
 * `ProfileData.readingPlans`. `plans` is null while loading; an error loads as none (plans are an
 * extra) and is kept in `error`.
 */
export function useReadingPlans() {
  const { state, dispatch } = useStore();
  const data = useProfileData();
  const member = Boolean(state.account?.userId);
  const profileId = state.activeProfileId;
  const [remote, setRemote] = useState<{ profileId: string; plans: ReadingPlan[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member || !profileId) return;
    let live = true;
    accountApi.loadReadingPlans(profileId).then(
      (plans) => live && setRemote({ profileId, plans }),
      (err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "We couldn't load your reading plans.");
        setRemote({ profileId, plans: [] });
      },
    );
    return () => {
      live = false;
    };
  }, [member, profileId]);

  const plans: ReadingPlan[] | null = member ? (remote?.profileId === profileId ? remote.plans : null) : (data.readingPlans ?? []);

  const save = useCallback(
    async (plan: ReadingPlan) => {
      const current = plans ?? [];
      const others = current.filter((p) => p.bookId !== plan.bookId);
      if (others.length >= PLANS_MAX) throw new accountApi.AccountError(`A profile can have up to ${PLANS_MAX} reading plans. Remove one to make another.`);
      const next = [...others, plan].sort((a, b) => a.finishBy.localeCompare(b.finishBy));
      if (member && profileId) {
        await accountApi.saveReadingPlan(profileId, plan);
        setRemote({ profileId, plans: next });
      } else dispatch({ type: "setReadingPlans", plans: next });
    },
    [plans, member, profileId, dispatch],
  );

  const remove = useCallback(
    async (bookId: string) => {
      const next = (plans ?? []).filter((p) => p.bookId !== bookId);
      if (member && profileId) {
        await accountApi.removeReadingPlan(profileId, bookId);
        setRemote({ profileId, plans: next });
      } else dispatch({ type: "setReadingPlans", plans: next });
    },
    [plans, member, profileId, dispatch],
  );

  return { plans, error, save, remove };
}
