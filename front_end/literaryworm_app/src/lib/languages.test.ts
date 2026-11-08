import { describe, expect, it } from "@jest/globals";
import { otherLanguageBooks } from "./languages";

describe("otherLanguageBooks", () => {
  it("lists the eight classics in French, German, Greek and Spanish, grouped by language", () => {
    const found = otherLanguageBooks("all");
    expect(found.map((b) => b.id).sort()).toEqual(
      [
        "candide-fr",
        "christougenniatika-diigimata",
        "effi-briest",
        "lazarillo-de-tormes",
        "madame-bovary-fr",
        "marianela",
        "max-und-moritz",
        "paramythi-horis-onoma",
      ].sort(),
    );
    expect(found.map((b) => b.language)).toEqual(["French", "French", "German", "German", "Greek", "Greek", "Spanish", "Spanish"]);
  });

  it("keeps a Kids profile to the titles rated for it", () => {
    expect(otherLanguageBooks("kids").map((b) => b.id)).toEqual(["max-und-moritz", "paramythi-horis-onoma"]);
  });

  it("gives a Teen profile every one, since none is rated above teen", () => {
    expect(otherLanguageBooks("teen")).toEqual(otherLanguageBooks("all"));
  });

  it("leaves out a book with no language rather than calling it another language", () => {
    const [first] = otherLanguageBooks("all");
    const missing = { ...first, language: undefined as unknown as string };
    expect(otherLanguageBooks("all", [missing, first]).map((b) => b.id)).toEqual([first.id]);
  });

  it("is empty for an empty catalog or one with only English titles", () => {
    expect(otherLanguageBooks("all", [])).toEqual([]);
    const english = otherLanguageBooks("all").map((b) => ({ ...b, language: "English" }));
    expect(otherLanguageBooks("all", english)).toEqual([]);
  });

  it("doesn't change the catalog it's given", () => {
    const catalog = otherLanguageBooks("all").reverse();
    const before = catalog.map((b) => b.id);
    otherLanguageBooks("all", catalog);
    expect(catalog.map((b) => b.id)).toEqual(before);
  });
});
