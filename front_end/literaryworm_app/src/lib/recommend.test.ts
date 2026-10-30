import { describe, expect, it } from "@jest/globals";
import { books, getBook } from "../data/books";
import type { LibraryEntry, ProfileData } from "../types";
import { moreLike, recommend, similarity, tasteSeeds } from "./recommend";

const dune = getBook("dune")!;
const history = (over: Partial<Pick<ProfileData, "readingDays" | "ratings" | "favorites">>) => ({
  readingDays: {},
  ratings: {},
  favorites: [],
  ...over,
});

describe("similarity", () => {
  it("is higher for a close book than a distant one, and 0 when nothing is shared", () => {
    expect(similarity(dune, dune)).toBeGreaterThan(similarity(dune, getBook("pride-and-prejudice")!));
    const stranger = { ...dune, id: "x", genres: ["Nothing alike"], author: "Someone else", series: undefined };
    expect(similarity({ ...dune, series: undefined }, stranger)).toBe(0);
  });
});

describe("tasteSeeds", () => {
  it("adds signals up and names the strongest", () => {
    const seeds = tasteSeeds(
      history({ readingDays: { "2026-01-01": { seconds: 60, finished: 1, books: ["dune"] } }, ratings: { dune: "love", frankenstein: "not-for-me" } }),
      {},
      getBook,
    );
    expect(seeds[0].book.id).toBe("dune");
    expect(seeds[0].reason).toBe("loved");
    expect(seeds[0].weight).toBeCloseTo(3.4);
    expect(seeds.find((s) => s.book.id === "frankenstein")!.weight).toBeLessThan(0);
  });

  it("skips books it can't find and has no seeds for an empty history", () => {
    expect(tasteSeeds(history({}), {}, getBook)).toEqual([]);
    const seeds = tasteSeeds(history({ favorites: ["no-such-book"], ratings: { "gone-too": "love" } }), {}, getBook);
    expect(seeds).toEqual([]);
  });

  it("counts finished books in the library too", () => {
    const library = { dune: { bookId: "dune", status: "finished" } as LibraryEntry };
    expect(tasteSeeds(history({}), library, getBook)[0]).toMatchObject({ reason: "finished" });
  });
});

describe("recommend", () => {
  const seeds = [{ book: dune, weight: 2, reason: "loved" as const }];

  it("never suggests a seed or an excluded book", () => {
    const ids = recommend(books, seeds, [], new Set(["project-hail-mary"])).map((r) => r.book.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain("dune");
    expect(ids).not.toContain("project-hail-mary");
  });

  it("says which seed pulled a book up", () => {
    expect(recommend(books, seeds, [], new Set())[0].because?.id).toBe("dune");
  });

  it("leaves out books with nothing to go on", () => {
    expect(recommend(books, [], [], new Set())).toEqual([]);
    expect(recommend([], seeds, [], new Set())).toEqual([]);
  });

  it("names no seed when only favourite genres pulled books up", () => {
    const [first] = recommend(books, [], [dune.genres[0]], new Set());
    expect(first.because).toBeNull();
  });

  it("finds books like one book, without the book itself", () => {
    const like = moreLike(dune, books, new Set());
    expect(like).not.toContain(dune);
    expect(like.length).toBeLessThanOrEqual(12);
  });
});
