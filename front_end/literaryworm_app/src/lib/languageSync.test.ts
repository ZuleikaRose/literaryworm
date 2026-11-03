import { describe, expect, it } from "@jest/globals";
import { languageStep, type LanguageSeen } from "./languageSync";

const seen = (profileId: string | null, language: LanguageSeen["language"], saved: LanguageSeen["saved"] = null): LanguageSeen => ({ profileId, language, saved });

describe("the language follows the profile", () => {
  it("does nothing before a profile is chosen", () => {
    expect(languageStep(seen(null, "en"), seen(null, "fr"))).toBeNull();
  });

  it("applies a profile's saved language when it's chosen", () => {
    expect(languageStep(seen(null, "en"), seen("a", "en", "es"))).toEqual({ kind: "apply", language: "es" });
    expect(languageStep(seen("a", "es", "es"), seen("b", "es", "de"))).toEqual({ kind: "apply", language: "de" });
  });

  it("keeps the visit's language for a profile that hasn't chosen one, without saving it", () => {
    expect(languageStep(seen(null, "fr"), seen("a", "fr", null))).toBeNull();
    expect(languageStep(seen("a", "es", "es"), seen("b", "es", null))).toBeNull();
  });

  it("applies a saved language that arrives after the profile was chosen", () => {
    expect(languageStep(seen("a", "en", null), seen("a", "en", "nl"))).toEqual({ kind: "apply", language: "nl" });
  });

  it("saves a language chosen in the menu to the profile", () => {
    expect(languageStep(seen("a", "en", null), seen("a", "it", null))).toEqual({ kind: "save", language: "it" });
    expect(languageStep(seen("a", "es", "es"), seen("a", "pt", "es"))).toEqual({ kind: "save", language: "pt" });
  });

  it("settles after applying or saving", () => {
    // After applying: the language now matches what's saved.
    expect(languageStep(seen("a", "en", "es"), seen("a", "es", "es"))).toBeNull();
    // After saving: the saved language catches up with the menu.
    expect(languageStep(seen("a", "it", null), seen("a", "it", "it"))).toBeNull();
  });

  it("never saves the last profile's language to the next one", () => {
    expect(languageStep(seen("a", "fr", "fr"), seen("b", "fr", "en"))).toEqual({ kind: "apply", language: "en" });
  });
});
