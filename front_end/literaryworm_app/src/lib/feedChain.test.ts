import { describe, expect, it } from "@jest/globals";
import { genreOrderAfter, genreQuery, genresAfter, nextFeedStep, openLibraryFor, sampleOf, shouldTopUp, TOP_UP_BELOW, TOP_UP_MAX, VISITOR_SAMPLE } from "./feedChain";

describe("genreQuery", () => {
  it("asks the home list for Technology and genre mode for the rest", () => {
    expect(genreQuery("technology")).toEqual({ mode: "home" });
    expect(genreQuery("horror")).toEqual({ mode: "genre", genre: "horror" });
  });
});

describe("genresAfter", () => {
  const genres = ["technology", "adventure", "sci-fi", "horror"] as const;

  it("runs on from the next genre, wraps round, and leaves the current one out", () => {
    expect(genresAfter("sci-fi", genres)).toEqual([
      { mode: "genre", genre: "horror" },
      { mode: "home" },
      { mode: "genre", genre: "adventure" },
    ]);
  });

  it("takes every genre in order when the current one isn't in the list", () => {
    expect(genresAfter("poetry", ["technology", "horror"])).toEqual([{ mode: "home" }, { mode: "genre", genre: "horror" }]);
  });
});

describe("Open Library on Home", () => {
  it("asks Open Library first only when told to", () => {
    expect(genreQuery("technology", true)).toEqual({ mode: "home", source: "openlibrary" });
    expect(genreQuery("horror", true)).toEqual({ mode: "genre", genre: "horror", source: "openlibrary" });
    expect(genresAfter("horror", ["technology", "horror"], true)).toEqual([{ mode: "home", source: "openlibrary" }]);
  });

  it("is for adult profiles only", () => {
    expect(openLibraryFor("all")).toBe(true);
    expect(openLibraryFor("teen")).toBe(false);
    expect(openLibraryFor("kids")).toBe(false);
  });
});

describe("genreOrderAfter", () => {
  it("lists the genres in the order the feed reads them, wrapping round, without the current one", () => {
    expect(genreOrderAfter("sci-fi", ["technology", "adventure", "sci-fi", "horror"])).toEqual(["horror", "technology", "adventure"]);
    expect(genreOrderAfter("horror", ["technology", "adventure", "sci-fi", "horror"])).toEqual(["technology", "adventure", "sci-fi"]);
    expect(genreOrderAfter("technology", ["technology"])).toEqual([]);
  });
});

describe("nextFeedStep", () => {
  it("asks the next page while the query has more", () => {
    expect(nextFeedStep(0, 3, true, 2)).toEqual({ step: 0, page: 4, done: false });
  });

  it("starts the next query at its first page when one runs out", () => {
    expect(nextFeedStep(0, 19, false, 3)).toEqual({ step: 1, page: 0, done: false });
  });

  it("ends after the last query", () => {
    expect(nextFeedStep(2, 5, false, 3)).toEqual({ step: 2, page: 5, done: true });
    expect(nextFeedStep(0, 0, false, 1)).toEqual({ step: 0, page: 0, done: true });
  });
});

describe("sampleOf", () => {
  const books = Array.from({ length: 25 }, (_, i) => i);

  it("shows everything without a limit", () => {
    expect(sampleOf(books, undefined)).toEqual({ shown: books, capped: false });
  });

  it("caps a visitor's sample at the limit", () => {
    const { shown, capped } = sampleOf(books, VISITOR_SAMPLE);
    expect(shown).toHaveLength(20);
    expect(capped).toBe(true);
  });

  it("isn't capped until the limit is reached", () => {
    expect(sampleOf(books.slice(0, 5), 20)).toEqual({ shown: books.slice(0, 5), capped: false });
  });
});

describe("shouldTopUp", () => {
  it("fetches the next page at once after a thin page, while there's more", () => {
    expect(shouldTopUp(2, false, 0)).toBe(true);
    expect(shouldTopUp(TOP_UP_BELOW - 1, false, TOP_UP_MAX - 1)).toBe(true);
  });

  it("waits for Load more after a full page, at the end, or after three top-ups in a row", () => {
    expect(shouldTopUp(TOP_UP_BELOW, false, 0)).toBe(false);
    expect(shouldTopUp(20, false, 0)).toBe(false);
    expect(shouldTopUp(2, true, 0)).toBe(false);
    expect(shouldTopUp(0, false, TOP_UP_MAX)).toBe(false);
  });
});
