import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { arrangeChoices, catalogChoice, type ClubBookChoice, choiceLabel, clubSortNote, isbnMatches, keywordMatch, seriesNames, uploadChoice } from "./clubBookChoices";
import { CLUB_BOOK_SORTS } from "./librarySort";
import { seriesInTitle } from "./librarySort";

const book = (id: string, title: string, author: string, series?: { name: string; order: number }): ClubBookChoice => ({ id, title, author, series });

const list = [
  book("a", "The Waves", "Virginia Woolf"),
  book("b", "1984", "George Orwell"),
  book("c", "Caliban's War", "James S. A. Corey", { name: "The Expanse", order: 2 }),
  book("d", "Leviathan Wakes", "James S. A. Corey", { name: "The Expanse", order: 1 }),
  book("e", "Anne of Avonlea", "L. M. Montgomery", { name: "Anne of Green Gables", order: 2 }),
  book("f", "10 Minutes 38 Seconds", "Elif Shafak"),
  book("g", "2 States", "Chetan Bhagat"),
];
const ids = (l: ClubBookChoice[]) => l.map((c) => c.id);

describe("sorting the books when starting a club", () => {
  it("sorts by title, without a leading The, numbers as numbers", () => {
    expect(ids(arrangeChoices(list, "title", ""))).toEqual(["g", "f", "b", "e", "c", "d", "a"]);
    expect(ids(arrangeChoices(list, "title-desc", ""))).toEqual(["a", "d", "c", "e", "b", "f", "g"]);
  });

  it("sorts by the author's surname", () => {
    expect(ids(arrangeChoices(list, "author", "")).slice(0, 3)).toEqual(["g", "c", "d"]);
    expect(ids(arrangeChoices(list, "author-desc", ""))[0]).toBe("a");
  });

  it("puts titles that start with a number first", () => {
    expect(ids(arrangeChoices(list, "numbers", "")).slice(0, 3)).toEqual(["g", "f", "b"]);
  });

  it("groups each series in reading order, then the books in none", () => {
    expect(ids(arrangeChoices(list, "series", ""))).toEqual(["e", "d", "c", "g", "f", "b", "a"]);
  });

  it("offers the same eleven sorts as My Library", () => {
    expect(CLUB_BOOK_SORTS.map((s) => s.label)).toEqual([
      "Recently added",
      "Oldest added",
      "Recently changed",
      "Title A–Z",
      "Title Z–A",
      "Numbers first (0–9)",
      "Author A–Z",
      "Author Z–A",
      "Published, newest",
      "Published, oldest",
      "Series, in reading order",
    ]);
  });

  const dated: ClubBookChoice[] = [
    { ...book("a", "Alpha", "A"), addedAt: 10, changedAt: 50, year: 1931 },
    { ...book("b", "Beta", "B"), addedAt: 30, year: 1949 },
    { ...book("c", "Gamma", "C"), year: null },
    { ...book("d", "Delta", "D"), addedAt: 20, changedAt: 20, year: 2001 },
  ];

  it("sorts by when each was added or changed, books not in the library last", () => {
    expect(ids(arrangeChoices(dated, "added", ""))).toEqual(["b", "d", "a", "c"]);
    expect(ids(arrangeChoices(dated, "added-oldest", ""))).toEqual(["a", "d", "b", "c"]);
    // Never changed counts from when it was added.
    expect(ids(arrangeChoices(dated, "updated", ""))).toEqual(["a", "b", "d", "c"]);
  });

  it("sorts by the year published, unknown years last either way", () => {
    expect(ids(arrangeChoices(dated, "published", ""))).toEqual(["d", "b", "a", "c"]);
    expect(ids(arrangeChoices(dated, "published-oldest", ""))).toEqual(["a", "b", "d", "c"]);
  });
});

describe("what a choice knows for the date sorts", () => {
  it("takes a catalog book's dates from the library and its last reading place", () => {
    const pride = getBook("pride-and-prejudice")!;
    expect(catalogChoice(pride)).toMatchObject({ addedAt: undefined, changedAt: undefined, year: pride.year });
    expect(catalogChoice(pride, { entry: { addedAt: 5 }, progress: { updatedAt: 9 } })).toMatchObject({ addedAt: 5, changedAt: 9 });
    expect(catalogChoice(pride, { entry: { addedAt: 5, updatedAt: 12 }, progress: { updatedAt: 9 } }).changedAt).toBe(12);
  });

  it("takes an upload's from when it was uploaded and last read, and the EPUB's year", () => {
    const upload = { id: "u-9", title: "Notes", author: "", createdAt: 3, publishedYear: 1999 };
    expect(uploadChoice(upload)).toMatchObject({ addedAt: 3, changedAt: 3, year: 1999 });
    expect(uploadChoice(upload, { updatedAt: 8 }).changedAt).toBe(8);
    expect(uploadChoice({ id: "u-8", title: "Old", author: "" }).year).toBeNull();
  });

  it("says what the date sorts go by", () => {
    expect(clubSortNote("added", "catalog")).toMatch(/in your library come first/);
    expect(clubSortNote("updated", "uploads")).toMatch(/read last comes first/);
    expect(clubSortNote("published", "uploads")).toMatch(/year in each EPUB/);
    expect(clubSortNote("title", "catalog")).toBeNull();
    expect(clubSortNote("published", "catalog")).toBeNull();
  });
});

describe("filtering by series", () => {
  it("lists the series there are, and keeps one series or the books in none", () => {
    expect(seriesNames(list)).toEqual(["Anne of Green Gables", "The Expanse"]);
    expect(ids(arrangeChoices(list, "title", "The Expanse"))).toEqual(["c", "d"]);
    expect(ids(arrangeChoices(list, "series", "The Expanse"))).toEqual(["d", "c"]);
    expect(ids(arrangeChoices(list, "title", "none"))).toEqual(["g", "f", "b", "a"]);
  });
});

describe("where a book's series comes from", () => {
  it("reads the series an uploaded EPUB's title names", () => {
    expect(seriesInTitle("Leviathan Wakes (The Expanse, #1)")).toEqual({ name: "The Expanse", order: 1 });
    expect(seriesInTitle("Dune (Dune Chronicles #1)")).toEqual({ name: "Dune Chronicles", order: 1 });
    expect(seriesInTitle("Novella (Series, #1.5)")).toEqual({ name: "Series", order: 1.5 });
    expect(seriesInTitle("Mansfield Park")).toBeUndefined();
    expect(uploadChoice({ id: "u-1", title: "Caliban's War (The Expanse, #2)", author: "James S. A. Corey" }).series).toEqual({ name: "The Expanse", order: 2 });
  });

  it("takes a LiteraryWorm title's series and number from the catalog", () => {
    const anne = getBook("anne-of-avonlea")!;
    expect(catalogChoice(anne).series).toEqual({ name: "Anne of Green Gables", order: 2 });
    expect(catalogChoice(getBook("frankenstein")!).series).toBeUndefined();
  });

  it("shows the series and number in the list, unless the title already does", () => {
    expect(choiceLabel(list[2])).toBe("Caliban's War (James S. A. Corey) · The Expanse #2");
    expect(choiceLabel(uploadChoice({ id: "u-1", title: "Leviathan Wakes (The Expanse, #1)", author: "" }))).toBe("Leviathan Wakes (The Expanse, #1)");
  });
});

describe("finding a club's book by ISBN", () => {
  it("keeps the books that are the edition Google Books gives for the ISBN", () => {
    const pride = catalogChoice(getBook("pride-and-prejudice")!);
    const upload = uploadChoice({ id: "u-2", title: "Caliban's War (The Expanse, #2)", author: "James S. A. Corey" });
    const choices = [pride, upload, ...list];
    expect(isbnMatches(choices, [{ title: "Pride and Prejudice", authors: ["Jane Austen"] }]).map((c) => c.id)).toEqual(["pride-and-prejudice"]);
    // An upload named with its series still matches; a subtitle on Google's side doesn't stop it.
    expect(isbnMatches(choices, [{ title: "Caliban's War: Book 2 of the Expanse", authors: ["James S. A. Corey"] }]).map((c) => c.id)).toEqual(["u-2", "c"]);
    // Same title, another author: not the same book.
    expect(isbnMatches(choices, [{ title: "Pride and Prejudice", authors: ["Someone Else"] }])).toEqual([]);
    expect(isbnMatches(choices, [])).toEqual([]);
  });
});

describe("finding a club's book by keywords", () => {
  it("looks through a catalog title's description and genres, not just its title and author", () => {
    const frankenstein = catalogChoice(getBook("frankenstein")!);
    expect(keywordMatch(frankenstein, "arctic ice")).toBe(true);
    expect(keywordMatch(frankenstein, "shelley creature")).toBe(true);
    expect(keywordMatch(frankenstein, "arctic zzzz")).toBe(false);
  });

  it("looks through an upload's part names", () => {
    const upload = uploadChoice({ id: "u-3", title: "The Long Voyage", author: "Ada Byron", chapterTitles: ["Departure", "The Storm"] });
    expect(keywordMatch(upload, "storm voyage")).toBe(true);
    expect(keywordMatch(upload, "harbour")).toBe(false);
    expect(keywordMatch(uploadChoice({ id: "u-4", title: "Untitled", author: "" }), "untitled")).toBe(true);
  });
});
