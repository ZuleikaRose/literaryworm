import { describe, expect, it } from "@jest/globals";
import { languageIn, yearIn } from "./epub";

describe("the year an EPUB was published", () => {
  it("takes the four-digit year a date starts with", () => {
    expect(yearIn("2019-05-02")).toBe(2019);
    expect(yearIn(" 1818 ")).toBe(1818);
    expect(yearIn("2011-08-25T00:00:00+00:00")).toBe(2011);
  });

  it("knows nothing when the date doesn't start with a year", () => {
    expect(yearIn("May 2019")).toBeNull();
    expect(yearIn("")).toBeNull();
    expect(yearIn(null)).toBeNull();
    expect(yearIn(undefined)).toBeNull();
    expect(yearIn("0000")).toBeNull();
  });
});

describe("an EPUB's language", () => {
  it("keeps the language before any region, in the two letters natural voices go by", () => {
    expect(languageIn("fr-FR")).toBe("fr");
    expect(languageIn(" EN_gb ")).toBe("en");
    expect(languageIn("ger")).toBe("de");
    expect(languageIn("nld")).toBe("nl");
    expect(languageIn("fre")).toBe("fr");
    expect(languageIn("Klingon")).toBeNull();
    expect(languageIn("")).toBeNull();
    expect(languageIn(undefined)).toBeNull();
  });
});
