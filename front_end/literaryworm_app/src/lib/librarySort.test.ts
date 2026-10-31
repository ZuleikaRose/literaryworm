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
    expect(readUploadSort(null)).toBe("uploaded");
    expect(readUploadSort("title-desc")).toBe("title-desc");
  });
});

describe("sortUploads", () => {
  const uploads = [
    { id: "a", title: "The Zebra", createdAt: 1 },
    { id: "b", title: "Apples", createdAt: 3 },
    { id: "c", title: "mango", createdAt: 2 },
  ];
  it("sorts by upload date and by title", () => {
    expect(sortUploads(uploads, "uploaded").map((u) => u.id)).toEqual(["b", "c", "a"]);
    expect(sortUploads(uploads, "uploaded-oldest").map((u) => u.id)).toEqual(["a", "c", "b"]);
    expect(sortUploads(uploads, "title").map((u) => u.id)).toEqual(["b", "c", "a"]);
    expect(sortUploads(uploads, "title-desc").map((u) => u.id)).toEqual(["a", "c", "b"]);
    expect(uploads.map((u) => u.id)).toEqual(["a", "b", "c"]);
  });
});
