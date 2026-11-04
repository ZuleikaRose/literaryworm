import { describe, expect, it } from "@jest/globals";
import type { A11ySettings, SavedA11y } from "../types";
import { a11yStep, parseSavedA11y, sameA11y, savedA11y } from "./a11ySync";

const base: SavedA11y = {
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
const big: SavedA11y = { ...base, textScale: 1.3, dyslexicFont: true };

describe("savedA11y", () => {
  it("keeps everything in the menu but the language", () => {
    const all: A11ySettings = { ...big, language: "fr" };
    expect(savedA11y(all)).toEqual(big);
    expect("language" in savedA11y(all)).toBe(false);
  });
});

describe("parseSavedA11y", () => {
  it("reads a kept row", () => {
    expect(parseSavedA11y({ ...big }, base)).toEqual(big);
  });

  it("is null when nothing is kept", () => {
    expect(parseSavedA11y(null, base)).toBeNull();
    expect(parseSavedA11y([], base)).toBeNull();
    expect(parseSavedA11y("big", base)).toBeNull();
  });

  it("falls back field by field for anything unknown or out of range", () => {
    expect(parseSavedA11y({ textScale: 9, theme: "neon", transcriptSize: "huge", highContrast: "yes", underlineLinks: true }, base)).toEqual({
      ...base,
      underlineLinks: true,
    });
  });

  it("accepts only the menu's three text sizes, the smallest and largest included", () => {
    expect(parseSavedA11y({ textScale: 1 }, big)?.textScale).toBe(1);
    expect(parseSavedA11y({ textScale: 1.3 }, base)?.textScale).toBe(1.3);
    expect(parseSavedA11y({ textScale: 1.15 }, base)?.textScale).toBe(1.15);
    expect(parseSavedA11y({ textScale: 1.31 }, base)?.textScale).toBe(1);
    expect(parseSavedA11y({ textScale: 0.99 }, base)?.textScale).toBe(1);
  });

  it("reads an empty kept object as the fallback", () => {
    expect(parseSavedA11y({}, big)).toEqual(big);
  });

  it("allows one interface font at a time, OpenDyslexic winning", () => {
    expect(parseSavedA11y({ readableFont: true, dyslexicFont: true }, base)).toMatchObject({ readableFont: false, dyslexicFont: true });
  });
});

describe("sameA11y", () => {
  it("compares every field", () => {
    expect(sameA11y(base, { ...base })).toBe(true);
    expect(sameA11y(base, { ...base, theme: "light" })).toBe(false);
    expect(sameA11y(null, null)).toBe(true);
    expect(sameA11y(base, null)).toBe(false);
  });
});

describe("a11yStep", () => {
  const seen = (profileId: string | null, current: SavedA11y, saved: SavedA11y | null) => ({ profileId, current, saved });

  it("does nothing before a profile is chosen", () => {
    expect(a11yStep(seen(null, base, null), seen(null, big, null))).toBeNull();
  });

  it("applies a profile's kept settings when it's chosen", () => {
    expect(a11yStep(seen(null, base, null), seen("p1", base, big))).toEqual({ kind: "apply", settings: big });
  });

  it("keeps what's on screen for a profile with nothing kept, and saves nothing until a change", () => {
    expect(a11yStep(seen(null, big, null), seen("p1", big, null))).toBeNull();
  });

  it("saves a change made in the menu", () => {
    expect(a11yStep(seen("p1", base, base), seen("p1", big, base))).toEqual({ kind: "save", settings: big });
  });

  it("applies settings that arrive from another device", () => {
    expect(a11yStep(seen("p1", base, base), seen("p1", base, big))).toEqual({ kind: "apply", settings: big });
  });

  it("never saves one profile's settings to the next when switching", () => {
    expect(a11yStep(seen("p1", big, big), seen("p2", big, null))).toBeNull();
    expect(a11yStep(seen("p1", big, big), seen("p2", big, base))).toEqual({ kind: "apply", settings: base });
  });

  it("doesn't save again once the change has been kept", () => {
    expect(a11yStep(seen("p1", big, base), seen("p1", big, big))).toBeNull();
  });
});
