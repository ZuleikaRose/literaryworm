// The accessibility menu's settings follow the profile (story 61): a member's choices are kept in
// reader_profiles.a11y_settings (migration 6673), so every device the profile is used on opens with
// them. The language is kept on its own (ui_language, lib/languageSync.ts) and isn't part of these.

import type { A11ySettings, SavedA11y } from "../types";

const SCALES = [1, 1.15, 1.3] as const;
const SIZES = ["small", "medium", "large"] as const;
const TRANSCRIPT_LANGUAGES = ["en", "es"] as const;
const SWITCHES = ["readableFont", "dyslexicFont", "highContrast", "reduceMotion", "underlineLinks", "transcript"] as const;

/** The menu's defaults, as kept settings; store/state.ts builds defaultA11y from these. */
export const DEFAULT_SAVED_A11Y: SavedA11y = {
  textScale: 1,
  readableFont: false,
  dyslexicFont: false,
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  theme: "dark",
  transcript: true,
  transcriptSize: "medium",
  transcriptLanguage: "en",
};

/** The settings a profile keeps: everything in the menu but the language. */
export function savedA11y(a: A11ySettings): SavedA11y {
  return {
    textScale: a.textScale,
    readableFont: a.readableFont,
    dyslexicFont: a.dyslexicFont,
    highContrast: a.highContrast,
    reduceMotion: a.reduceMotion,
    underlineLinks: a.underlineLinks,
    theme: a.theme,
    transcript: a.transcript,
    transcriptSize: a.transcriptSize,
    transcriptLanguage: a.transcriptLanguage,
  };
}

/**
 * A profile's kept settings as read from the database, checked field by field: anything unknown or
 * out of range falls back to `fallback` (so an older row, or one from a newer app, still opens).
 * Null when there's nothing kept.
 */
export function parseSavedA11y(raw: unknown, fallback: SavedA11y): SavedA11y | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: SavedA11y = { ...fallback };
  if (typeof r.textScale === "number" && (SCALES as readonly number[]).includes(r.textScale)) out.textScale = r.textScale;
  for (const key of SWITCHES) if (typeof r[key] === "boolean") out[key] = r[key] as boolean;
  if (r.theme === "dark" || r.theme === "light") out.theme = r.theme;
  if ((SIZES as readonly unknown[]).includes(r.transcriptSize)) out.transcriptSize = r.transcriptSize as SavedA11y["transcriptSize"];
  if ((TRANSCRIPT_LANGUAGES as readonly unknown[]).includes(r.transcriptLanguage)) {
    out.transcriptLanguage = r.transcriptLanguage as SavedA11y["transcriptLanguage"];
  }
  // One interface font at a time, as the menu allows.
  if (out.readableFont && out.dyslexicFont) out.readableFont = false;
  return out;
}

/** True when two sets of kept settings say the same thing. */
export function sameA11y(a: SavedA11y | null, b: SavedA11y | null): boolean {
  if (!a || !b) return a === b;
  return (Object.keys(a) as (keyof SavedA11y)[]).every((k) => a[k] === b[k]);
}

export interface A11ySeen {
  profileId: string | null;
  current: SavedA11y;
  saved: SavedA11y | null;
}

export type A11yStep = { kind: "apply"; settings: SavedA11y } | { kind: "save"; settings: SavedA11y } | null;

/**
 * What the sync does after a render, the same rule as the language: a profile's kept settings are
 * applied when it's chosen (or when they arrive from another device); a change made in the menu
 * while a profile is in use is kept for it. Switching profile never saves one profile's settings to
 * the next; a profile with nothing kept yet keeps what's on screen until something is changed.
 */
export function a11yStep(prev: A11ySeen, now: A11ySeen): A11yStep {
  if (!now.profileId) return null;
  const switched = prev.profileId !== now.profileId;
  const arrived = !switched && !sameA11y(now.saved, prev.saved) && sameA11y(prev.current, now.current);
  if (switched || arrived) return now.saved && !sameA11y(now.saved, now.current) ? { kind: "apply", settings: now.saved } : null;
  if (!sameA11y(prev.current, now.current) && !sameA11y(now.current, now.saved)) return { kind: "save", settings: now.current };
  return null;
}
