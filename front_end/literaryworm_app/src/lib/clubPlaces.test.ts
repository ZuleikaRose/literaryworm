import { describe, expect, it } from "@jest/globals";
import { type ClubPlace, demoPlaces, placeLabel, sortPlaces } from "./clubPlaces";

const place = (o: Partial<ClubPlace>): ClubPlace => ({ userId: "u", name: "Ada", chapterIndex: 0, fraction: 0, finished: false, updatedAt: 0, ...o });

describe("club places", () => {
  it("names the chapter (counting from 1) and how far through, or finished", () => {
    expect(placeLabel(place({ chapterIndex: 7, fraction: 0.416 }))).toBe("Chapter 8 · 42%");
    expect(placeLabel(place({ chapterIndex: 20, fraction: 1, finished: true }))).toBe("Finished");
  });

  it("puts the furthest first, finished readers at the top", () => {
    const sorted = sortPlaces([
      place({ userId: "a", name: "Bo", fraction: 0.2 }),
      place({ userId: "b", name: "Al", fraction: 0.6 }),
      place({ userId: "c", name: "Cy", fraction: 0.4, finished: true }),
      place({ userId: "d", name: "Ab", fraction: 0.2 }),
    ]);
    expect(sorted.map((p) => p.userId)).toEqual(["c", "b", "d", "a"]);
  });

  it("gives the demo's other members sample places", () => {
    const places = demoPlaces([{ userId: "me", name: "You" }, { userId: "x", name: "Sam" }, { userId: "y", name: "Ana" }], "me", 1_000_000_000);
    expect(places.map((p) => [p.name, placeLabel(p)])).toEqual([["Sam", "Chapter 4 · 18%"], ["Ana", "Chapter 9 · 45%"]]);
  });
});
