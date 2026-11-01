import { describe, expect, it } from "@jest/globals";
import { yearStats } from "./stats";
import { slideFileName, slideText, storySlides } from "./yearStory";

const finishedOn = (day: string, books: string[]) => ({ [day]: { seconds: 3600, finished: books.length, books } });

describe("storySlides", () => {
  const days = {
    ...finishedOn("2026-01-10", ["dune"]),
    ...finishedOn("2026-03-02", ["pride-and-prejudice", "unknown-id"]),
    "2026-03-03": { seconds: 600, finished: 0 },
  };
  const stats = yearStats(days, [], 2026);

  it("opens with the year, ends with the next, and has a screen for each fact", () => {
    const slides = storySlides("Avery", stats, 5);
    expect(slides.map((s) => s.id)).toEqual(["intro", "time", "books", "streak", "favourites", "when", "outro"]);
    expect(slides[0]).toMatchObject({ big: "2026", line: "Avery's year in books" });
    expect(slides.at(-1)!.big).toBe("On to 2027");
  });

  it("counts books finished, with the goal and the covers it knows", () => {
    const books = storySlides("Avery", stats, 5).find((s) => s.id === "books")!;
    expect(books.big).toBe("3");
    expect(books.detail).toBe("2 to go for a goal of 5.");
    expect(books.covers.map((b) => b.id)).toEqual(["pride-and-prejudice", "dune"]);
    expect(storySlides("Avery", stats, 3).find((s) => s.id === "books")!.detail).toBe("Goal of 3 reached.");
  });

  it("names the busiest month and the streak", () => {
    const slides = storySlides("Avery", stats, null);
    expect(slides.find((s) => s.id === "when")!.big).toBe("March");
    expect(slides.find((s) => s.id === "streak")).toMatchObject({ big: "2", line: "days in a row, at best" });
  });

  it("leaves out screens with nothing to say", () => {
    const empty = storySlides("Sam", yearStats({}, [], 2026), null);
    expect(empty.map((s) => s.id)).toEqual(["intro", "outro"]);
  });

  it("gives each screen its words and a file name", () => {
    const [intro, time] = storySlides("Avery", stats, null);
    expect(slideText(intro)).toBe("Year in review: 2026 Avery's year in books. Tap through to see it.");
    expect(slideText(time)).toBe("Time with books: 2 h of reading and listening.");
    expect(slideFileName(2026, time)).toBe("literaryworm-2026-story-time.png");
  });
});
