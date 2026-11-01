import { describe, expect, it } from "@jest/globals";
import { finishDays, isRereading, ordinal, readsLine, timesRead, timesReadLabel } from "./rereads";

const days = {
  "2026-03-02": { books: ["dune", "circe"] },
  "2025-01-10": { books: ["dune"] },
  "2026-01-01": { books: [] },
  "2026-02-01": {},
};

describe("rereads", () => {
  it("lists the days a book was finished, oldest first", () => {
    expect(finishDays(days, "dune")).toEqual(["2025-01-10", "2026-03-02"]);
    expect(finishDays(days, "babel")).toEqual([]);
  });

  it("counts reads from finish days, or once for a Finished book with none known", () => {
    expect(timesRead({ status: "finished" }, ["2025-01-10", "2026-03-02"])).toBe(2);
    expect(timesRead({ status: "finished" }, [])).toBe(1);
    expect(timesRead({ status: "reading" }, [])).toBe(0);
    expect(timesRead(undefined, [])).toBe(0);
  });

  it("knows a reread: Reading with a finish day", () => {
    expect(isRereading({ status: "reading" }, ["2025-01-10"])).toBe(true);
    expect(isRereading({ status: "reading" }, [])).toBe(false);
    expect(isRereading({ status: "finished" }, ["2025-01-10"])).toBe(false);
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
  });

  it("says how often a book was read, and nothing for once", () => {
    expect(timesReadLabel(1)).toBe("");
    expect(timesReadLabel(2)).toBe("Read twice");
    expect(timesReadLabel(5)).toBe("Read 5 times");
    expect(readsLine({ status: "reading" }, ["2025-01-10"])).toBe("Your 2nd read");
    expect(readsLine({ status: "finished" }, ["2025-01-10", "2026-03-02"])).toBe("Read twice");
    expect(readsLine({ status: "finished" }, ["2025-01-10"])).toBe("");
  });
});
