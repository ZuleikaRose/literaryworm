import type { UiLanguage } from "./i18n";

/** What the profile's language sync should do after a render. */
export type LanguageStep = { kind: "apply"; language: UiLanguage } | { kind: "save"; language: UiLanguage } | null;

export interface LanguageSeen {
  profileId: string | null;
  language: UiLanguage;
  saved: UiLanguage | null;
}

/**
 * The language follows the profile (story 67): a profile's saved language is applied when it's
 * chosen (or when its saved language arrives from another device), and a language chosen in the
 * accessibility menu while a profile is in use is saved to it. Switching profile never saves the
 * last profile's language to the next one.
 */
export function languageStep(prev: LanguageSeen, now: LanguageSeen): LanguageStep {
  if (!now.profileId) return null;
  const switched = prev.profileId !== now.profileId;
  const arrived = !switched && now.saved !== prev.saved && now.saved !== now.language && prev.language === now.language;
  if (switched || arrived) return now.saved && now.saved !== now.language ? { kind: "apply", language: now.saved } : null;
  if (prev.language !== now.language && now.language !== now.saved) return { kind: "save", language: now.language };
  return null;
}
