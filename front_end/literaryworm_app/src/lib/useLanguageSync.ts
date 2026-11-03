import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { type LanguageSeen, languageStep } from "./languageSync";

/**
 * Keeps the app's language with the active profile: members' choices are saved to
 * reader_profiles.ui_language in the background, so every device opens in it; the demo keeps it in
 * memory for the visit. Before a profile is chosen the visit's own language (the browser's) is used.
 */
export function useLanguageSync() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const saved = useProfileData().uiLanguage ?? null;
  const language = state.a11y.language;
  const remote = Boolean(state.account?.userId);
  const seen = useRef<LanguageSeen>({ profileId: null, language, saved: null });

  useEffect(() => {
    const now: LanguageSeen = { profileId: profile?.id ?? null, language, saved };
    const step = languageStep(seen.current, now);
    seen.current = now;
    if (!step || !profile) return;
    if (step.kind === "apply") {
      dispatch({ type: "updateA11y", patch: { language: step.language } });
      return;
    }
    dispatch({ type: "patchProfileData", patch: { uiLanguage: step.language } });
    if (remote) accountApi.saveUiLanguage(profile.id, step.language).catch((err: Error) => console.error("language: couldn't save:", err.message));
  }, [profile, language, saved, remote, dispatch]);
}
