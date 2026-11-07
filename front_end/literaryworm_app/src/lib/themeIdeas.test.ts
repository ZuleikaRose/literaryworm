import { describe, expect, it } from "@jest/globals";
import type { Book } from "../types";
import type { Challenge, ThemeBook } from "./challenges";
import { activeThemesChallenge, themeIdeas } from "./themeIdeas";

const challenge = (over: Partial<Challenge>): Challenge => ({
  id: "c",
  title: "Around",
  kind: "themes",
  target: 6,
  startsOn: "2026-11-01",
  endsOn: "2026-11-30",
  createdBy: "p1",
  participants: ["p1"],
  ...over,
});

const details: Record<string, ThemeBook> = {
  old: { year: 1818, genres: ["Classics"], pages: 280, language: "en", inSeries: false },
  french: { year: 1950, genres: ["Literary fiction"], pages: 200, language: "fr", inSeries: false },
  poems: { year: 1950, genres: ["Poetry"], pages: 90, language: "en", inSeries: false },
  owned: { year: 1850, genres: ["Classics"], pages: 300, language: "en", inSeries: false },
};
const catalog = Object.keys(details).map((id) => ({ id }) as Book);

describe("theme challenge ideas", () => {
  it("finds the running themes challenge this profile joined, ending soonest", () => {
    const list = [
      challenge({ id: "late", endsOn: "2026-12-31" }),
      challenge({ id: "soon", endsOn: "2026-11-20" }),
      challenge({ id: "books", kind: "books" }),
      challenge({ id: "others", participants: ["p2"] }),
      challenge({ id: "past", startsOn: "2026-10-01", endsOn: "2026-10-31" }),
    ];
    expect(activeThemesChallenge(list, "p1", "2026-11-10")?.id).toBe("soon");
    expect(activeThemesChallenge(list, "p3", "2026-11-10")).toBeNull();
    expect(activeThemesChallenge([], "p1", "2026-11-10")).toBeNull();
  });

  it("suggests books for the first themes not yet covered, leaving out the library", () => {
    const days = { "2026-11-02": { seconds: 600, finished: 1, books: ["french"] } };
    const ideas = themeIdeas({ challenge: challenge({}), days, catalog, bookOf: (id) => details[id], skip: (id) => id === "owned" });
    // "another language" is covered by the French book; before 1900 and poetry come first after it.
    expect(ideas.map((i) => [i.themeId, i.books.map((b) => b.id)])).toEqual([
      ["old", ["old"]],
      ["poetry", ["poems"]],
    ]);
  });

  it("has nothing to suggest with an empty catalog", () => {
    expect(themeIdeas({ challenge: challenge({}), days: {}, catalog: [], bookOf: () => undefined, skip: () => false })).toEqual([]);
  });
});
