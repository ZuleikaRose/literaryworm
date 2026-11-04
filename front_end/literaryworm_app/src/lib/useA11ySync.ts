import { useEffect, useMemo, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import type { SavedA11y } from "../types";
import { type A11ySeen, a11yStep, savedA11y } from "./a11ySync";

/**
 * Keeps the accessibility menu with the active profile (story 61), like the language
 * (useLanguageSync): members' choices are saved to reader_profiles.a11y_settings in the background,
 * so every device opens with them; the demo keeps them in memory for the visit. Before a profile is
 * chosen, the visit's own settings are used.
 */
export function useA11ySync() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const saved = useProfileData().a11ySettings ?? null;
  // A new object only when a kept setting changes (not when the language does).
  const key = JSON.stringify(savedA11y(state.a11y));
  const current = useMemo(() => JSON.parse(key) as SavedA11y, [key]);
  const remote = Boolean(state.account?.userId);
  const seen = useRef<A11ySeen>({ profileId: null, current, saved: null });

  useEffect(() => {
    const now: A11ySeen = { profileId: profile?.id ?? null, current, saved };
    const step = a11yStep(seen.current, now);
    seen.current = now;
    if (!step || !profile) return;
    if (step.kind === "apply") {
      dispatch({ type: "updateA11y", patch: step.settings });
      return;
    }
    dispatch({ type: "patchProfileData", patch: { a11ySettings: step.settings } });
    if (remote) {
      accountApi.saveA11ySettings(profile.id, step.settings).catch((err: Error) => console.error("accessibility: couldn't save:", err.message));
    }
  }, [profile, current, saved, remote, dispatch]);
}
