import { describe, expect, it } from "@jest/globals";
import { clubYear, clubYearShown } from "./clubYear";

const at = (iso: string) => Date.parse(iso);

describe("a club's year together", () => {
  it("shows in December for this year and in January for last year", () => {
    expect(clubYearShown(new Date(2026, 11, 3))).toBe(2026);
    expect(clubYearShown(new Date(2027, 0, 20))).toBe(2026);
    expect(clubYearShown(new Date(2026, 6, 1))).toBeNull();
  });

  it("counts that year's posts, meetings held and highlights, never past the reader's chapter", () => {
    const year = clubYear(
      {
        posts: [
          { userId: "a", chapterIndex: 0, createdAt: at("2026-03-01T12:00:00") },
          { userId: "b", chapterIndex: 2, createdAt: at("2026-04-01T12:00:00") },
          { userId: "a", chapterIndex: 2, createdAt: at("2026-05-01T12:00:00") },
          // Past the reader's place: not counted, not even as the busiest chapter.
          { userId: "c", chapterIndex: 9, createdAt: at("2026-06-01T12:00:00") },
          { userId: "c", chapterIndex: 9, createdAt: at("2026-06-02T12:00:00") },
          { userId: "c", chapterIndex: 9, createdAt: at("2026-06-03T12:00:00") },
          // Another year.
          { userId: "d", chapterIndex: 1, createdAt: at("2025-12-30T12:00:00") },
        ],
        meetings: [{ startsAt: "2026-05-10T18:00:00Z" }, { startsAt: "2026-12-30T18:00:00Z" }],
        highlights: [
          { chapterIndex: 1, createdAt: at("2026-02-01T12:00:00") },
          { chapterIndex: 8, createdAt: at("2026-02-01T12:00:00") },
        ],
        upTo: 3,
      },
      2026,
      at("2026-12-15T12:00:00"),
    );
    expect(year).toEqual({ year: 2026, posts: 3, posters: 2, meetings: 1, highlights: 1, busiestChapter: 2 });
  });

  it("has no busiest chapter without posts", () => {
    expect(clubYear({ posts: [], meetings: [], highlights: [], upTo: 0 }, 2026).busiestChapter).toBeNull();
  });
});
