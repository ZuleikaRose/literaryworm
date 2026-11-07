import type { Book, ReadingDay } from "../types";
import { type Challenge, challengeStatus, THEME_PROMPTS, type ThemeBook, themesCovered } from "./challenges";

/**
 * Book ideas for a household *Themes covered* challenge (Discover): for the first themes this
 * profile hasn't covered yet in a running challenge it joined, catalog books that fit, which it
 * may see and hasn't got in its library. Worked out in the browser.
 */
export interface ThemeIdea {
  challenge: Challenge;
  themeId: string;
  label: string;
  books: Book[];
}

/** The running themes challenge this profile joined (the one ending soonest), if any. */
export function activeThemesChallenge(challenges: Challenge[], profileId: string, today: string): Challenge | null {
  return (
    challenges
      .filter((c) => c.kind === "themes" && c.participants.includes(profileId) && challengeStatus(c, today) === "active")
      .sort((a, b) => a.endsOn.localeCompare(b.endsOn))[0] ?? null
  );
}

export function themeIdeas(input: {
  challenge: Challenge;
  days: Record<string, ReadingDay>;
  catalog: Book[];
  bookOf: (id: string) => ThemeBook | undefined;
  skip: (id: string) => boolean;
  themes?: number;
  perTheme?: number;
}): ThemeIdea[] {
  const { challenge, days, catalog, bookOf, skip, themes = 2, perTheme = 12 } = input;
  const covered = new Set(themesCovered(days, challenge.startsOn, challenge.endsOn, bookOf));
  const ideas: ThemeIdea[] = [];
  for (const prompt of THEME_PROMPTS) {
    if (ideas.length >= themes || covered.has(prompt.id)) continue;
    const fitting = catalog.filter((b) => !skip(b.id) && prompt.fits(bookOf(b.id) ?? { year: 0, genres: [], pages: 0, language: "en", inSeries: false }));
    if (fitting.length) ideas.push({ challenge, themeId: prompt.id, label: prompt.label, books: fitting.slice(0, perTheme) });
  }
  return ideas;
}
