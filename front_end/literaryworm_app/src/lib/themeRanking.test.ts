import { describe, expect, it } from "@jest/globals";
import type { Book } from "../types";
import type { Seed } from "./recommend";
import { FOLLOW_LIFT, MOOD_WEIGHT, moodSeeds, themeRank, topMoods } from "./themeRanking";

const book = (id: string, over: Partial<Book> = {}) => ({ id, author: "A. Writer", narrator: "N. Reader", genres: ["Classics"], rating: 4, ...over }) as Book;

describe("theme idea ranking", () => {
  it("counts the moods the profile uses most", () => {
    const moods = {
      a: { moods: ["dark" as const, "tense" as const], pace: null },
      b: { moods: ["dark" as const], pace: "fast" as const },
      c: { moods: ["funny" as const], pace: null },
    };
    expect(topMoods(moods, 2)).toEqual(["dark", "funny"]);
    const seeds = moodSeeds(moods, (id) => book(id));
    expect(seeds.find((s) => s.book.id === "a")?.weight).toBeCloseTo(MOOD_WEIGHT * 2);
    expect(moodSeeds(moods, () => undefined)).toEqual([]);
  });

  it("lifts books like the ones enjoyed and by people followed, and lowers ones like those disliked", () => {
    const loved = book("loved", { genres: ["Mystery"], author: "Agatha" });
    const disliked = book("disliked", { genres: ["Romance"], author: "Someone" });
    const seeds: Seed[] = [
      { book: loved, weight: 2, reason: "loved" },
      { book: disliked, weight: -1.6, reason: "liked" },
    ];
    const rank = themeRank({ seeds, moodSeeds: [], follows: [{ kind: "narrator", name: "Kate Reading" }] });
    const mystery = book("m", { genres: ["Mystery"], author: "Other" });
    const romance = book("r", { genres: ["Romance"], author: "Other" });
    const plain = book("p", { genres: ["Poetry"], author: "Other" });
    const narrated = book("n", { genres: ["Poetry"], author: "Other", narrator: "kate reading" });
    expect(rank(mystery)).toBeGreaterThan(rank(plain));
    expect(rank(romance)).toBeLessThan(rank(plain));
    expect(rank(plain)).toBe(0);
    expect(rank(narrated)).toBe(FOLLOW_LIFT);
    // A seed never scores itself.
    expect(themeRank({ seeds: [{ book: loved, weight: 2, reason: "loved" }], moodSeeds: [], follows: [] })(loved)).toBe(0);
  });
});
