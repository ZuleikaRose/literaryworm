import { describe, expect, it } from "@jest/globals";
import { parsePronunciations, piecePronunciations, PRONUNCIATIONS_MAX, pronunciationKey, sayAs, voiceFile } from "./naturalVoice";
import { parseAllPronunciations, PRONOUNCE_BOOKS_MAX, pronunciationError, withPronunciation } from "./pronunciations";

describe("pronunciations", () => {
  it("respells whole words only, in any case, longest first, and leaves other text alone", () => {
    const pron = { Hermione: "her-MY-oh-nee", "Mary Anne": "MAIR-ee ANN", Mary: "MAIR-ee" };
    expect(sayAs("Hermione's cat met Hermiones and HERMIONE.", pron)).toBe("her-MY-oh-nee's cat met Hermiones and her-MY-oh-nee.");
    expect(sayAs("Mary  Anne and Mary went.", pron)).toBe("MAIR-ee ANN and MAIR-ee went.");
    expect(sayAs("Nothing to change.", pron)).toBe("Nothing to change.");
    expect(sayAs("Siobhán smiled.", { Siobhán: "shiv-AWN" })).toBe("shiv-AWN smiled.");
  });

  it("finds which words a piece has, and keys only those, the same whatever their order", () => {
    const pron = { Hermione: "her-MY-oh-nee", Saoirse: "SEER-sha" };
    expect(piecePronunciations("Saoirse waved.", pron)).toEqual({ Saoirse: "SEER-sha" });
    expect(piecePronunciations("Nobody waved.", pron)).toEqual({});
    expect(pronunciationKey({})).toBe("");
    expect(pronunciationKey({ a: "x", b: "y" })).toBe(pronunciationKey({ b: "y", a: "x" }));
    expect(pronunciationKey({ a: "x" })).toMatch(/^[0-9a-f]{8}$/);
    expect(pronunciationKey({ a: "x" })).not.toBe(pronunciationKey({ a: "z" }));
    expect(voiceFile("u", "u-1", "v", 2, 3, false, "abcd1234")).toBe("u/u-1/v-2-3-pabcd1234.mp3");
    expect(voiceFile("u", "u-1", "v", 2, 3, true)).toBe("u/u-1/v-2-c3.mp3");
  });

  it("keeps only words and respellings made of letters, one per word", () => {
    expect(parsePronunciations({ " Hermione ": " her-MY-oh-nee ", hermione: "x", "<b>": "x", Ron: "", Kvothe: "KVOH-thee", Same: "same" })).toEqual({
      Hermione: "her-MY-oh-nee",
      Kvothe: "KVOH-thee",
    });
    expect(parsePronunciations(["x"])).toEqual({});
    const many = Object.fromEntries(Array.from({ length: PRONUNCIATIONS_MAX + 5 }, (_, i) => [`Name${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, "say"]));
    expect(Object.keys(parsePronunciations(many))).toHaveLength(PRONUNCIATIONS_MAX);
  });

  it("explains what can't be kept", () => {
    expect(pronunciationError("", "x")).toMatch(/as the book writes it/);
    expect(pronunciationError("Kvothe", "")).toMatch(/how it sounds/);
    expect(pronunciationError("Kvothe", "kvothe")).toMatch(/differently/);
    expect(pronunciationError("Kv0the", "KVOH-thee")).toMatch(/letters/);
    expect(pronunciationError("Kvothe", "KVOH-thee")).toBeNull();
  });

  it("sets, replaces and removes a book's words, keeping the newest books", () => {
    let all = withPronunciation({}, "u-1", "Kvothe", "KVOH-thee");
    all = withPronunciation(all, "u-1", "kvothe", "KVOTH");
    expect(all).toEqual({ "u-1": { kvothe: "KVOTH" } });
    expect(withPronunciation(all, "u-1", "KVOTHE", null)).toEqual({});
    let many: ReturnType<typeof withPronunciation> = {};
    for (let i = 0; i <= PRONOUNCE_BOOKS_MAX; i++) many = withPronunciation(many, `b${i}`, "Kvothe", "KVOH-thee");
    expect(Object.keys(many)).toHaveLength(PRONOUNCE_BOOKS_MAX);
    expect(many.b0).toBeUndefined();
    expect(parseAllPronunciations({ "u-1": { Kvothe: "KVOH-thee" }, "u-2": { "?": "x" }, "u-3": "x" })).toEqual({ "u-1": { Kvothe: "KVOH-thee" } });
  });
});
