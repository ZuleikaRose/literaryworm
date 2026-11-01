import { describe, expect, it } from "@jest/globals";
import { codeOf, defaultTarget, passageFor, TRANSLATE_LANGUAGES, TRANSLATE_MAX } from "./translate";

describe("translate", () => {
  it("offers seven languages and maps names to codes", () => {
    expect(TRANSLATE_LANGUAGES).toHaveLength(7);
    expect(codeOf("French")).toBe("fr");
    expect(codeOf("Latin")).toBeNull();
  });

  it("starts with English for a book in another language, else Spanish, and remembers a choice", () => {
    expect(defaultTarget("French", null)).toBe("en");
    expect(defaultTarget("French", "de")).toBe("de");
    // Never the book's own language.
    expect(defaultTarget("French", "fr")).toBe("en");
    expect(defaultTarget("English", null)).toBe("es");
    expect(defaultTarget(undefined, "it")).toBe("it");
    expect(defaultTarget("English", "en")).toBe("es");
  });

  it("keeps short passages and cuts long ones at a sentence or a word", () => {
    expect(passageFor("  Il  était\nune fois. ")).toBe("Il était une fois.");
    const sentences = "A short sentence here. ".repeat(80);
    const cut = passageFor(sentences);
    expect(cut.length).toBeLessThanOrEqual(TRANSLATE_MAX);
    expect(cut.endsWith(".")).toBe(true);
    const words = "word ".repeat(400);
    const w = passageFor(words);
    expect(w.length).toBeLessThanOrEqual(TRANSLATE_MAX);
    expect(w.endsWith("word")).toBe(true);
  });
});
