import { describe, expect, it } from "@jest/globals";
import { getBook } from "../data/books";
import { SERIES } from "../data/series";
import { allSeries, continueSeries, nextInSeries, seriesNamed, seriesOf, seriesPath, seriesPlace } from "./series";

describe("the series list", () => {
  it("names only books in the catalog, each in one series", () => {
    const ids = SERIES.flatMap((s) => s.ids);
    expect(ids.filter((id) => !getBook(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps catalog books that set a series of their own", () => {
    expect(seriesOf("dune")?.name).toBe("Dune Chronicles");
    expect(allSeries.every((s) => s.ids.length > 0)).toBe(true);
  });
});

describe("finding a series", () => {
  it("finds by name in any case and builds its path", () => {
    expect(seriesNamed("anne of green gables")?.ids[0]).toBe("anne-of-green-gables");
    expect(seriesNamed(undefined)).toBeUndefined();
    expect(seriesPath("The d'Artagnan Romances")).toBe("/series/The%20d'Artagnan%20Romances");
  });

  it("gives a book's place", () => {
    expect(seriesPlace("anne-of-avonlea")).toMatchObject({ position: 2, total: 6 });
    expect(seriesPlace("frankenstein")).toBeNull();
  });
});

describe("what comes next", () => {
  it("is the following book", () => {
    expect(nextInSeries("anne-of-green-gables", "all")?.id).toBe("anne-of-avonlea");
    expect(nextInSeries("rilla-of-ingleside", "all")).toBeUndefined();
    expect(nextInSeries("frankenstein", "all")).toBeUndefined();
  });

  it("continues after the furthest book finished, once per series", () => {
    const next = continueSeries(["anne-of-green-gables", "anne-of-the-island", "the-three-musketeers"], "all").map((b) => b.id);
    expect(next).toEqual(["annes-house-of-dreams", "twenty-years-after"]);
  });

  it("offers nothing when the series is done or nothing was finished", () => {
    expect(continueSeries(["alice-in-wonderland", "through-the-looking-glass"], "all")).toEqual([]);
    expect(continueSeries([], "all")).toEqual([]);
  });
});
