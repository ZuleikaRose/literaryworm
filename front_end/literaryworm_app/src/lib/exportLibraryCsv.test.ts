import { describe, expect, it } from "@jest/globals";
import { csvCell, type ExportBook, exportCsvName, GOODREADS_HEADER, lastFinished, lastFirst, STORYGRAPH_HEADER, toCsv } from "./exportLibraryCsv";
import { parseCsv, readImport } from "./importCsv";

const added = new Date(2026, 9, 3, 12).getTime();
const books: ExportBook[] = [
  { bookId: "frankenstein", title: "Frankenstein", authors: ["Mary Shelley"], status: "finished", addedAt: added, finishedOn: "2026-10-20", pages: 280, year: 1818, rating: "love" },
  { bookId: "g1", title: 'Tales, "Old" and New', authors: ["Ursula K. Le Guin", "Someone Else"], status: "reading", addedAt: added, finishedOn: null, pages: null, year: null, rating: "like" },
  { bookId: "g2", title: "=SUM(A1)", authors: [], status: "want_to_read", addedAt: added, finishedOn: null, pages: 100, year: 2001, rating: null },
];

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks, and leaves plain text alone", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("keeps a formula-like value as text", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@me")).toBe("'@me");
    // A title starting with a dash stays as it is.
    expect(csvCell("-ish")).toBe("-ish");
  });
});

describe("lastFirst", () => {
  it("puts the last word first", () => {
    expect(lastFirst("Ursula K. Le Guin")).toBe("Le Guin, Ursula K.");
    expect(lastFirst("Simone de Beauvoir")).toBe("de Beauvoir, Simone");
    expect(lastFirst("Ludwig van der Berg")).toBe("van der Berg, Ludwig");
    // The first name is never taken as a particle.
    expect(lastFirst("La Guma")).toBe("Guma, La");
    expect(lastFirst("Mary Shelley")).toBe("Shelley, Mary");
    expect(lastFirst("Homer")).toBe("Homer");
  });
});

describe("toCsv", () => {
  it("writes Goodreads' columns and our importer reads them back", () => {
    const csv = toCsv(books, "goodreads");
    const [header, first] = parseCsv(csv);
    expect(header).toEqual(GOODREADS_HEADER);
    expect(first[GOODREADS_HEADER.indexOf("Date Read")]).toBe("2026/10/20");
    expect(first[GOODREADS_HEADER.indexOf("Date Added")]).toBe("2026/10/03");
    expect(first[GOODREADS_HEADER.indexOf("Number of Pages")]).toBe("280");
    const back = readImport(csv);
    expect(back.source).toBe("goodreads");
    expect(back.rows.map((r) => [r.title, r.author, r.status, r.rating])).toEqual([
      ["Frankenstein", "Mary Shelley", "finished", "love"],
      ['Tales, "Old" and New', "Ursula K. Le Guin", "reading", "like"],
      ["'=SUM(A1)", "", "want_to_read", null],
    ]);
  });

  it("writes StoryGraph's columns and our importer reads them back", () => {
    const csv = toCsv(books, "storygraph");
    expect(parseCsv(csv)[0]).toEqual(STORYGRAPH_HEADER);
    const back = readImport(csv);
    expect(back.source).toBe("storygraph");
    expect(back.rows.map((r) => [r.title, r.status, r.rating])).toEqual([
      ["Frankenstein", "finished", "love"],
      ['Tales, "Old" and New', "reading", "like"],
      ["'=SUM(A1)", "want_to_read", null],
    ]);
    expect(parseCsv(csv)[2][STORYGRAPH_HEADER.indexOf("Authors")]).toBe("Ursula K. Le Guin, Someone Else");
  });

  it("writes Didn't finish as did-not-finish and rereads as Read Count and Dates Read, and reads them back", () => {
    const more: ExportBook[] = [
      { ...books[0], readDays: ["2025-01-10", "2026-10-20"], mood: { moods: ["dark", "tense"], pace: "slow" } },
      { bookId: "g3", title: "Moods", authors: ["Louisa May Alcott"], status: "did_not_finish", addedAt: added, finishedOn: null, pages: null, year: null, rating: null },
    ];
    const gr = parseCsv(toCsv(more, "goodreads"));
    expect(gr[1][GOODREADS_HEADER.indexOf("Read Count")]).toBe("2");
    expect(gr[2][GOODREADS_HEADER.indexOf("Exclusive Shelf")]).toBe("did-not-finish");
    expect(gr[2][GOODREADS_HEADER.indexOf("Read Count")]).toBe("0");
    const sgCsv = toCsv(more, "storygraph");
    const sg = parseCsv(sgCsv);
    expect(sg[1][STORYGRAPH_HEADER.indexOf("Dates Read")]).toBe("2025/01/10-2025/01/10, 2026/10/20-2026/10/20");
    expect(sg[1][STORYGRAPH_HEADER.indexOf("Read Count")]).toBe("2");
    expect(sg[1][STORYGRAPH_HEADER.indexOf("Moods")]).toBe("dark, tense");
    expect(sg[1][STORYGRAPH_HEADER.indexOf("Pace")]).toBe("slow");
    expect(sg[2][STORYGRAPH_HEADER.indexOf("Read Status")]).toBe("did-not-finish");
    expect(readImport(sgCsv).rows.map((r) => r.status)).toEqual(["finished", "did_not_finish"]);
    expect(readImport(toCsv(more, "goodreads")).rows.map((r) => r.status)).toEqual(["finished", "did_not_finish"]);
  });

  it("is just the header for an empty library, with a byte-order mark and CRLF line ends", () => {
    const csv = toCsv([], "goodreads");
    expect(csv.startsWith("﻿Book Id,Title")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(parseCsv(csv)).toHaveLength(1);
  });

  it("names the file by site and day", () => {
    expect(exportCsvName("storygraph", "2026-11-01")).toBe("literaryworm-storygraph-2026-11-01.csv");
  });
});

describe("lastFinished", () => {
  it("keeps the latest day each book was finished, and is empty with no days", () => {
    expect(lastFinished({ "2026-10-01": { books: ["a"] }, "2026-10-09": { books: ["a", "b"] }, "2026-10-05": {} })).toEqual({ a: "2026-10-09", b: "2026-10-09" });
    expect(lastFinished({})).toEqual({});
  });
});
