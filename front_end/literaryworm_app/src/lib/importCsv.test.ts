import { describe, expect, it } from "@jest/globals";
import { catalogMatch, detectSource, IMPORT_MAX_ROWS, parseCsv, pickMatch, ratingFromStars, readImport, sameBook, searchTitle } from "./importCsv";

// The first columns of each service's export, in their order.
const GOODREADS =
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review\n' +
  '1,"Dune (Dune, #1)",Frank Herbert,"Herbert, Frank",,"=""0441013597""","=""9780441013593""",5,4.27,Ace,Paperback,688,2005,1965,2024/03/02,2024/01/10,,,read,"Loved it, ""spice"" and all"\n' +
  '2,Circe,Madeline Miller,"Miller, Madeline",,,,3,4.27,,,,,,,2024/02/01,,,currently-reading,\n' +
  '3,"The Thursday Murder Club: A Novel",Richard Osman,"Osman, Richard",,,,0,4.0,,,,,,,2024/02/01,favourites,,to-read,"line one\nline two"\n';

const STORYGRAPH =
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?\r\n" +
  "Frankenstein,Mary Shelley,,9780141439471,paperback,read,2024/01/01,2024/01/20,,1,,,,,,,,4.75,,,,,No\r\n" +
  'Good Omens,"Terry Pratchett, Neil Gaiman",,,,did-not-finish,2024/01/01,,,0,,,,,,,,,,,,,No\r\n' +
  "Babel,R.F. Kuang,,,,paused,2024/01/01,,,0,,,,,,,,2.5,,,,,No\r\n";

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('a,"b, c","say ""hi""","one\ntwo"\r\n1,2,3,4')).toEqual([
      ["a", "b, c", 'say "hi"', "one\ntwo"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("skips blank lines and a byte-order mark, and keeps empty fields", () => {
    expect(parseCsv("﻿a,,c\n\n\n1,2,\n")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("readImport", () => {
  it("recognises each service from its header", () => {
    expect(detectSource(parseCsv(GOODREADS)[0])).toBe("goodreads");
    expect(detectSource(parseCsv(STORYGRAPH)[0])).toBe("storygraph");
    expect(detectSource(["Name", "Writer"])).toBeNull();
  });

  it("reads a Goodreads export: shelves as statuses, stars as ratings", () => {
    const file = readImport(GOODREADS);
    expect(file.source).toBe("goodreads");
    expect(file.skipped).toBe(0);
    expect(file.rows).toEqual([
      { line: 2, title: "Dune (Dune, #1)", author: "Frank Herbert", status: "finished", rating: "love" },
      { line: 3, title: "Circe", author: "Madeline Miller", status: "reading", rating: "like" },
      { line: 4, title: "The Thursday Murder Club: A Novel", author: "Richard Osman", status: "want_to_read", rating: null },
    ]);
  });

  it("reads a StoryGraph export, leaving out books not finished and taking the first author", () => {
    const file = readImport(STORYGRAPH);
    expect(file.source).toBe("storygraph");
    expect(file.skipped).toBe(1);
    expect(file.rows).toEqual([
      { line: 2, title: "Frankenstein", author: "Mary Shelley", status: "finished", rating: "love" },
      { line: 4, title: "Babel", author: "R.F. Kuang", status: "reading", rating: "not-for-me" },
    ]);
  });

  it("refuses a file that isn't an export, or one that's too long", () => {
    expect(() => readImport("Name,Writer\nDune,Herbert")).toThrow(/Goodreads or StoryGraph/);
    expect(() => readImport("")).toThrow(/Goodreads or StoryGraph/);
    const header = "Title,Author,Exclusive Shelf\n";
    expect(() => readImport(header + "Dune,Frank Herbert,read\n".repeat(IMPORT_MAX_ROWS + 1))).toThrow(/up to 1000/);
  });

  it("skips rows without a title and treats unknown shelves as want to read", () => {
    const file = readImport("Title,Author,Exclusive Shelf\n,Nobody,read\nDune,Frank Herbert,favourites\n");
    expect(file.skipped).toBe(1);
    expect(file.rows[0].status).toBe("want_to_read");
  });
});

describe("ratingFromStars", () => {
  it("maps stars to Love it, Like it and Not for me", () => {
    expect([5, 4.5, 4, 3, 2.75, 1, 0].map(ratingFromStars)).toEqual(["love", "love", "like", "like", "not-for-me", "not-for-me", null]);
    expect(ratingFromStars(Number.NaN)).toBeNull();
  });
});

describe("matching", () => {
  it("searches by the main title: no series, subtitle or characters search refuses", () => {
    expect(searchTitle("Dune (Dune, #1)")).toBe("Dune");
    expect(searchTitle("The Thursday Murder Club: A Novel")).toBe("The Thursday Murder Club");
    expect(searchTitle("Harry Potter and the Philosopher's Stone — Illustrated")).toBe("Harry Potter and the Philosopher's Stone");
    expect(searchTitle("1984 #")).toBe("1984");
    expect(searchTitle("###")).toBeNull();
  });

  it("matches the same title and author's surname, ignoring case and accents", () => {
    const row = { title: "Dune (Dune, #1)", author: "Frank Herbert" };
    expect(sameBook(row, { title: "Dune", authors: ["Frank Herbert"] })).toBe(true);
    expect(sameBook(row, { title: "DUNE Messiah", authors: ["Frank Herbert"] })).toBe(false);
    expect(sameBook(row, { title: "Dune: Deluxe Edition", authors: ["Frank Herbert"] })).toBe(true);
    expect(sameBook(row, { title: "Dune", authors: ["Brian Herbert", "Kevin J. Anderson"] })).toBe(true);
    expect(sameBook(row, { title: "Dune", authors: ["Someone Else"] })).toBe(false);
    expect(sameBook({ title: "Les Misérables", author: "Victor Hugo" }, { title: "Les miserables", authors: ["Victor Hugo"] })).toBe(true);
  });

  it("finds catalog titles the profile may see", () => {
    expect(catalogMatch({ title: "Dune (Dune, #1)", author: "Frank Herbert" }, "all")?.id).toBe("dune");
    expect(catalogMatch({ title: "Dracula", author: "Bram Stoker" }, "kids")).toBeNull();
    expect(catalogMatch({ title: "Not a catalog book", author: "Nobody" }, "all")).toBeNull();
  });

  it("picks the first search result that is the book", () => {
    const results = [
      { id: "a", title: "Circe: A Study Guide", authors: ["Study Press"] },
      { id: "b", title: "Circe", authors: ["Madeline Miller"] },
    ];
    expect(pickMatch({ title: "Circe", author: "Madeline Miller" }, results)?.id).toBe("b");
    expect(pickMatch({ title: "Circe", author: "Madeline Miller" }, [])).toBeNull();
  });
});
