import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { yearStats } from "./stats";
import { cardTime, YEAR_CARD_COVERS, yearCardFacts, yearCardFileName, yearCardText } from "./yearCard";

const finishedOn = (day: string, books: string[]) => ({ [day]: { seconds: 3600, finished: books.length, books } });

describe("cardTime", () => {
  it("shows whole hours once there are any, minutes before that", () => {
    expect(cardTime(0)).toBe("0 min");
    expect(cardTime(35 * 60)).toBe("35 min");
    expect(cardTime(60 * 60)).toBe("1 h");
    expect(cardTime(42 * 3600 + 59 * 60)).toBe("42 h");
  });
});

describe("yearCardFacts", () => {
  const days = {
    ...finishedOn("2026-01-10", ["dune"]),
    ...finishedOn("2026-03-02", ["pride-and-prejudice", "unknown-id"]),
    "2026-03-03": { seconds: 600, finished: 0 },
  };
  const stats = yearStats(days, [], 2026);

  it("names the profile and the year, and gives the four numbers", () => {
    const facts = yearCardFacts("Avery", stats, 12);
    expect(facts.title).toBe("Avery's 2026 in books");
    expect(facts.numbers).toEqual([
      { value: "3", label: "books finished of 12" },
      { value: "2 h", label: "reading and listening" },
      { value: "3", label: "days with reading" },
      { value: "2", label: "days in a row, at best" },
    ]);
  });

  it("leaves out the goal when there isn't one and says one in the singular", () => {
    const one = yearCardFacts("Sam", yearStats(finishedOn("2026-05-01", ["dune"]), [], 2026), null);
    expect(one.numbers[0]).toEqual({ value: "1", label: "book finished" });
    expect(one.numbers[2]).toEqual({ value: "1", label: "day with reading" });
  });

  it("shows covers only for books it knows, newest first, each once, and a few at most", () => {
    const facts = yearCardFacts("Avery", stats, null);
    expect(facts.covers.map((b) => b.id)).toEqual(["pride-and-prejudice", "dune"]);
    const many = yearStats(
      Object.fromEntries(["dune", "dune", "circe", "babel", "tomorrow", "educated", "frankenstein"].map((id, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { seconds: 60, finished: 1, books: [id] }])),
      [],
      2026,
    );
    const covers = yearCardFacts("Avery", many, null).covers;
    expect(covers.length).toBe(YEAR_CARD_COVERS);
    expect(new Set(covers.map((b) => b.id)).size).toBe(covers.length);
    expect(covers[0].id).toBe("frankenstein");
  });

  it("names the top genre and author, or nothing for a year without known books", () => {
    expect(yearCardFacts("Avery", stats, null).favourites).toMatch(/^Top genre: .+ · Top author: .+$/);
    expect(yearCardFacts("Avery", yearStats({ "2026-01-01": { seconds: 600, finished: 0 } }, [], 2026), null).favourites).toBeNull();
  });
});

describe("the card's words and file", () => {
  it("reads the card out for screen readers and sharing as text", () => {
    const facts = yearCardFacts("Avery", yearStats(finishedOn("2026-01-10", ["dune"]), [], 2026), null);
    expect(yearCardText(facts)).toBe(
      `Avery's 2026 in books: 1 book finished, 1 h reading and listening, 1 day with reading, 1 day in a row, at best. Top genre: ${getBook("dune")!.genres[0]} · Top author: Frank Herbert.`,
    );
  });

  it("names the file after the year", () => {
    expect(yearCardFileName(2026)).toBe("literaryworm-2026-in-books.png");
  });
});
