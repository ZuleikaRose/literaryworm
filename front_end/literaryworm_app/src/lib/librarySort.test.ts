import { describe, expect, it } from "@jest/globals";
import type { LibraryEntry } from "../types";
import { authorKey, publishedYear, readLibrarySort, readUploadSort, sortLibrary, sortTitle, sortUploads, type SortDetails } from "./librarySort";

const books: Record<string, SortDetails> = {
  hobbit: { title: "The Hobbit", author: "J. R. R. Tolkien", year: 1937 },
  dune: { title: "Dune", author: "Frank Herbert", year: 1965 },
  "1984": { title: "1984", author: "George Orwell", year: 1949 },
  "20k": { title: "20,000 Leagues Under the Sea", author: "Jules Verne", year: 1870 },
  "2s": { title: "2 States", author: "Chetan Bhagat", year: null },
  apple: { title: "an apple a day", author: "Ann Other", year: 2020 },
};

const entry = (bookId: string, addedAt: number, updatedAt?: number): LibraryEntry => ({ bookId, status: "reading", addedAt, updatedAt });
const entries = [entry("hobbit", 5, 50), entry("dune", 4), entry("1984", 3, 90), entry("20k", 2), entry("2s", 1), entry("apple", 6)];
const ids = (sort: Parameters<typeof sortLibrary>[1]) => sortLibrary(entries, sort, (e) => books[e.bookId]).map((e) => e.bookId);

describe("sortLibrary", () => {
  it("groups each series A–Z in reading order, then the books in none by title", () => {
    const withSeries: Record<string, SortDetails> = {
      ...books,
      hobbit: { ...books.hobbit, series: { name: "Middle-earth", order: 1 } },
      dune: { ...books.dune, series: { name: "Dune", order: 1 } },
      "20k": { ...books["20k"], series: { name: "Dune", order: 2 } },
    };
    expect(sortLibrary(entries, "series", (e) => withSeries[e.bookId]).map((e) => e.bookId)).toEqual(["dune", "20k", "hobbit", "2s", "1984", "apple"]);
  });

  it("orders by when books were added, either way", () => {
    expect(ids("added")).toEqual(["apple", "hobbit", "dune", "1984", "20k", "2s"]);
    expect(ids("added-oldest")).toEqual(["2s", "20k", "1984", "dune", "hobbit", "apple"]);
  });

  it("orders by the last change, falling back to when it was added", () => {
    expect(ids("updated")).toEqual(["1984", "hobbit", "apple", "dune", "20k", "2s"]);
  });

  it("sorts titles A–Z and Z–A, ignoring a leading The or An and comparing numbers as numbers (2 < 20 < 1984)", () => {
    expect(ids("title")).toEqual(["2s", "20k", "1984", "apple", "dune", "hobbit"]);
    expect(ids("title-desc")).toEqual(["hobbit", "dune", "apple", "1984", "20k", "2s"]);
  });

  it("puts titles starting with a number first", () => {
    expect(ids("numbers")).toEqual(["2s", "20k", "1984", "apple", "dune", "hobbit"]);
    const noNumbers = [entry("hobbit", 1), entry("dune", 2)];
    expect(sortLibrary(noNumbers, "numbers", (e) => books[e.bookId]).map((e) => e.bookId)).toEqual(["dune", "hobbit"]);
  });

  it("sorts authors by surname", () => {
    expect(ids("author")).toEqual(["2s", "dune", "1984", "apple", "hobbit", "20k"]);
  });

  it("sorts authors by surname Z–A, with ties still by title A–Z", () => {
    expect(ids("author-desc")).toEqual(["20k", "hobbit", "apple", "1984", "dune", "2s"]);
    const sameAuthor = [entry("hobbit", 1), entry("dune", 2)];
    const one = (): { title: string; author: string; year: null } => ({ title: "", author: "Same Writer", year: null });
    const titled = (e: { bookId: string }) => ({ ...one(), title: e.bookId === "hobbit" ? "The Hobbit" : "Dune" });
    expect(sortLibrary(sameAuthor, "author-desc", titled).map((e) => e.bookId)).toEqual(["dune", "hobbit"]);
  });

  it("sorts by published year with unknown years last both ways", () => {
    expect(ids("published")).toEqual(["apple", "dune", "1984", "hobbit", "20k", "2s"]);
    expect(ids("published-oldest")).toEqual(["20k", "hobbit", "1984", "dune", "apple", "2s"]);
  });

  it("keeps a stable order for ties and doesn't change the list it's given", () => {
    const same = [entry("a", 1), entry("b", 2)];
    const details = (): SortDetails => ({ title: "Same", author: "X", year: null });
    expect(sortLibrary(same, "title", details).map((e) => e.bookId)).toEqual(["b", "a"]);
    expect(same.map((e) => e.bookId)).toEqual(["a", "b"]);
    expect(sortLibrary([], "title", details)).toEqual([]);
  });
});

describe("helpers", () => {
  it("drops leading articles from titles", () => {
    expect(sortTitle("The Hobbit")).toBe("Hobbit");
    expect(sortTitle("  A Tale of Two Cities")).toBe("Tale of Two Cities");
    expect(sortTitle("Theatre")).toBe("Theatre");
    expect(sortTitle("")).toBe("");
  });

  it("keys authors by the first author's surname", () => {
    expect(authorKey("Frank Herbert")).toBe("Herbert Frank Herbert");
    expect(authorKey("Neil Gaiman, Terry Pratchett")).toBe("Gaiman Neil Gaiman");
    expect(authorKey("Homer")).toBe("Homer Homer");
  });

  it("reads the year from Google's dates", () => {
    expect(publishedYear("2019-05-02")).toBe(2019);
    expect(publishedYear("1999")).toBe(1999);
    expect(publishedYear("")).toBeNull();
    expect(publishedYear(null)).toBeNull();
    expect(publishedYear(undefined)).toBeNull();
    expect(publishedYear("May 2019")).toBeNull();
  });

  it("falls back to the default for unknown sorts", () => {
    expect(readLibrarySort(null)).toBe("added");
    expect(readLibrarySort("nonsense")).toBe("added");
    expect(readLibrarySort("author")).toBe("author");
    expect(readLibrarySort("author-desc")).toBe("author-desc");
    expect(readUploadSort(null)).toBe("added");
    expect(readUploadSort("title-desc")).toBe("title-desc");
    expect(readUploadSort("series")).toBe("series");
    expect(readLibrarySort("series")).toBe("series");
    // Addresses saved before uploads had every sort still work.
    expect(readUploadSort("uploaded")).toBe("added");
    expect(readUploadSort("uploaded-oldest")).toBe("added-oldest");
  });
});

describe("sortUploads", () => {
  const uploads = [
    { id: "a", title: "The Zebra", author: "Ada Byron", createdAt: 1, publishedYear: 1990 },
    { id: "b", title: "Apples", author: "Zoe Adams", createdAt: 3, publishedYear: null },
    { id: "c", title: "mango", author: "Mary Shelley", createdAt: 2, publishedYear: 2015 },
    { id: "d", title: "1984", author: "George Orwell", createdAt: 0 },
  ];
  const ids = (sort: Parameters<typeof sortUploads>[1], changed?: (u: (typeof uploads)[number]) => number) =>
    sortUploads(uploads, sort, changed).map((u) => u.id);

  it("sorts by when each was uploaded, and by title", () => {
    expect(ids("added")).toEqual(["b", "c", "a", "d"]);
    expect(ids("added-oldest")).toEqual(["d", "a", "c", "b"]);
    expect(ids("title")).toEqual(["d", "b", "c", "a"]);
    expect(ids("title-desc")).toEqual(["a", "c", "b", "d"]);
    expect(ids("numbers")).toEqual(["d", "b", "c", "a"]);
    expect(uploads.map((u) => u.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts by the last time each was read, else when it was uploaded", () => {
    const read: Record<string, number> = { a: 10, d: 5 };
    expect(ids("updated", (u) => read[u.id] ?? u.createdAt)).toEqual(["a", "d", "b", "c"]);
    expect(ids("updated")).toEqual(["b", "c", "a", "d"]);
  });

  it("sorts by the author's surname", () => {
    expect(ids("author")).toEqual(["b", "a", "d", "c"]);
    expect(ids("author-desc")).toEqual(["c", "d", "a", "b"]);
  });

  it("sorts by the year published, unknown years last either way", () => {
    expect(ids("published")).toEqual(["c", "a", "d", "b"]);
    expect(ids("published-oldest")).toEqual(["a", "c", "d", "b"]);
  });

  it("groups each series its title names in reading order, then the rest by title", () => {
    const books = [
      { id: "x", title: "Caliban's War (The Expanse, #2)", author: "", createdAt: 1 },
      { id: "y", title: "Dune (Dune Chronicles #1)", author: "", createdAt: 2 },
      { id: "z", title: "Leviathan Wakes (The Expanse, #1)", author: "", createdAt: 3 },
      { id: "w", title: "Emma", author: "", createdAt: 4 },
      { id: "v", title: "Abaddon's Gate (The Expanse, #3)", author: "", createdAt: 5 },
    ];
    expect(sortUploads(books, "series").map((b) => b.id)).toEqual(["y", "z", "x", "v", "w"]);
  });
});
