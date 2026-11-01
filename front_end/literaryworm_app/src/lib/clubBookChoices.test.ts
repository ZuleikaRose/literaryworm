import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { arrangeChoices, catalogChoice, type ClubBookChoice, choiceLabel, seriesNames, uploadChoice } from "./clubBookChoices";
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
