import { describe, expect, it } from "@jest/globals";
import { deviceVoiceGender } from "./deviceVoiceGender";
import { CAST_NAMES, castNamesFor, NATURAL_VOICES, voiceGender } from "./naturalVoice";

describe("voice gender", () => {
  it("knows the natural voices, and every language has a woman's and a man's", () => {
    expect(voiceGender("Aoede")).toBe("woman");
    expect(voiceGender("Charon")).toBe("man");
    expect(voiceGender("Puck")).toBe("man");
    expect(voiceGender("Kore")).toBe("woman");
    expect(voiceGender("Neural2 D")).toBe("man");
    // A name it doesn't know (or none) counts as a woman's, as Google's list has more of those.
    expect(voiceGender("")).toBe("woman");
    expect(voiceGender("Nobody")).toBe("woman");
    const languages = new Set(NATURAL_VOICES.map((v) => v.languageCode));
    for (const code of languages) {
      const genders = new Set(NATURAL_VOICES.filter((v) => v.languageCode === code).map((v) => voiceGender(v.name)));
      expect([code, [...genders].sort()]).toEqual([code, ["man", "woman"]]);
    }
  });

  it("offers men's and women's character voices in every language", () => {
    expect(CAST_NAMES.filter((n) => voiceGender(n) === "man").length).toBeGreaterThanOrEqual(3);
    for (const code of ["en-GB", "ru-RU", "fil-PH"]) {
      const genders = new Set(castNamesFor(code).map(voiceGender));
      expect(genders.size).toBe(2);
    }
  });

  it("reads a device voice's gender from its name, and says nothing when the name doesn't tell", () => {
    expect(deviceVoiceGender({ name: "Microsoft Ryan Online (Natural) - English (United Kingdom)" })).toBe("man");
    expect(deviceVoiceGender({ name: "Microsoft Libby Online (Natural) - English (United Kingdom)" })).toBe("woman");
    expect(deviceVoiceGender({ name: "Google UK English Female" })).toBe("woman");
    expect(deviceVoiceGender({ name: "Google UK English Male" })).toBe("man");
    expect(deviceVoiceGender({ name: "Daniel" })).toBe("man");
    expect(deviceVoiceGender({ name: "Karen" })).toBe("woman");
    expect(deviceVoiceGender({ name: "Microsoft Guy Online (Natural) - English (United States)" })).toBe("man");
    // "female" must not read as "male".
    expect(deviceVoiceGender({ name: "English (Great Britain) female" })).toBe("woman");
    expect(deviceVoiceGender({ name: "Bad News" })).toBeNull();
    expect(deviceVoiceGender({ name: "" })).toBeNull();
  });
});
