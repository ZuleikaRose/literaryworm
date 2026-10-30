import { describe, expect, it } from "vitest";
import { catalogMatches, didYouMean, fitsLength, normalizeQuery, queryError, readSearchParams, searchUrl } from "./search";

describe("queries", () => {
  it("tidies spaces", () => {
    expect(normalizeQuery("  the   midnight\tlibrary ")).toBe("the midnight library");
  });

  it("checks queries with the books function's rules", () => {
    expect(queryError("")).toMatch(/Enter a title/);
    expect(queryError("x".repeat(101))).toMatch(/limited to 100/);
    expect(queryError("<script>")).toMatch(/letters, numbers/);
    expect(queryError("Pride & Prejudice")).toBeNull();
    expect(queryError("Cien años de soledad")).toBeNull();
  });
});

describe("the URL", () => {
  it("round-trips a search", () => {
    const params = { q: "dune", genre: null, sort: "newest", source: "google", lang: "es", length: "long" } as const;
    const url = searchUrl(params);
    expect(url).toBe("/search?q=dune&sort=newest&source=google&lang=es&length=long");
    expect(readSearchParams(new URLSearchParams(url.split("?")[1]))).toEqual(params);
  });

  it("falls back to defaults for anything unexpected", () => {
    expect(readSearchParams(new URLSearchParams("sort=popular&source=x&lang=zz&length=huge&genre=nope"))).toEqual({
      q: "",
      genre: null,
      sort: "relevance",
      source: "all",
      lang: null,
      length: null,
    });
    expect(searchUrl(readSearchParams(new URLSearchParams()))).toBe("/search");
  });
});

describe("fitsLength", () => {
  it("never fits an unknown length to a filter", () => {
    expect(fitsLength(null, "short")).toBe(false);
    expect(fitsLength(null, null)).toBe(true);
  });

  it("includes each band's edges", () => {
    expect(fitsLength(199, "short")).toBe(true);
    expect(fitsLength(200, "medium")).toBe(true);
    expect(fitsLength(400, "medium")).toBe(true);
    expect(fitsLength(401, "long")).toBe(true);
  });
});

describe("catalog search", () => {
  const base = { genre: null, sort: "relevance", source: "all", lang: null, length: null } as const;

  it("matches word starts in the title, ignoring case", () => {
    expect(catalogMatches({ ...base, q: "MIDN libr" }, "all").map((b) => b.id)).toEqual(["the-midnight-library"]);
  });

  it("hides titles above the profile's age rating", () => {
    expect(catalogMatches({ ...base, q: "dracula" }, "all")).toHaveLength(1);
    expect(catalogMatches({ ...base, q: "dracula" }, "kids")).toHaveLength(0);
  });

  it("suggests a likely typo only when the correction finds something", () => {
    expect(didYouMean("midnite libary", "all")).toBe("Midnight Library");
    expect(didYouMean("zzzzzz qqqqq", "all")).toBeNull();
  });
});
