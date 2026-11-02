import { describe, expect, it } from "@jest/globals";
import { textPages } from "./reading";
import { detailsMatch, HITS_PER_BOOK, hitPath, queryWords, searchPages, uploadDetails, uploadQueryError } from "./uploadSearch";

const upload = { title: "The Long Voyage", author: "Ada Byron", chapterTitles: ["Departure", "The Storm"] };

describe("searching uploads by title or author", () => {
  it("matches every word from the start of a word", () => {
    expect(detailsMatch(upload, "long voy", "title")).toBe(true);
    expect(detailsMatch(upload, "byron", "title")).toBe(false);
    expect(detailsMatch(upload, "byron", "author")).toBe(true);
    expect(detailsMatch(upload, "storm", "keywords")).toBe(true);
    expect(detailsMatch(upload, "", "author")).toBe(true);
  });
});

describe("searching uploads by keywords", () => {
  const chapters = [
    "The ship left harbour at dawn.\n\nNobody aboard expected the weather to turn.",
    "A storm rose in the night. The storm tore the sails, and the crew sheltered below.",
  ];
  const pages = textPages(chapters);

  it("finds each place a word starts, with its chapter and page", () => {
    const result = searchPages(pages, "storm", uploadDetails(upload))!;
    expect(result.count).toBe(2);
    expect(result.hits[0]).toMatchObject({ chapterIndex: 1, page: 0, match: "storm" });
    expect(result.hits[0].after.startsWith(" rose")).toBe(true);
    expect(hitPath("u-1", result.hits[0])).toBe("/read/u-1?chapter=1&page=0");
  });

  it("needs every word somewhere in the text or the book's details", () => {
    expect(searchPages(pages, "storm harbour")).not.toBeNull();
    expect(searchPages(pages, "storm zebra")).toBeNull();
    // Byron is only the author: the book still matches, with the text's places.
    expect(searchPages(pages, "byron storm", uploadDetails(upload))?.count).toBe(2);
    expect(searchPages(pages, "byron", uploadDetails(upload))).toEqual({ hits: [], count: 0 });
  });

  it("ignores case and matches the start of words only", () => {
    expect(searchPages(pages, "SHIP")?.count).toBe(1);
    expect(searchPages(pages, "helter")).toBeNull();
    expect(searchPages(pages, "shelter")?.hits[0].match).toBe("shelter");
  });

  it("shows only the first few places", () => {
    const many = textPages([Array.from({ length: 10 }, () => "storm").join(" ")]);
    const result = searchPages(many, "storm")!;
    expect(result.count).toBe(10);
    expect(result.hits).toHaveLength(HITS_PER_BOOK);
  });

  it("checks the query", () => {
    expect(uploadQueryError("  ")).toBe("Enter a word or two to search for.");
    expect(uploadQueryError("!!!")).toBe("Search using letters or numbers.");
    expect(uploadQueryError("x".repeat(101))).toMatch(/limited to 100/);
    expect(uploadQueryError("storm")).toBeNull();
    expect(queryWords("the Storm, the theory")).toEqual(["theory", "storm", "the"]);
  });
});
