import { useEffect, useState } from "react";
import { books, getBook, isAllowed } from "../data/books";
import { fromLocal } from "../lib/booksApi";
import type { Challenge } from "../lib/challenges";
import { today } from "../lib/reading";
import { themeBookOf } from "../lib/themeBooks";
import { activeThemesChallenge, themeIdeas } from "../lib/themeIdeas";
import { moodSeeds, themeRank } from "../lib/themeRanking";
import type { Seed } from "../lib/recommend";
import { useChallenges } from "../lib/useChallenges";
import { useT } from "../lib/useT";
import { useActiveProfile, useProfileData } from "../store/context";
import { Shelf } from "./Shelf";

/**
 * Discover: books for the themes this profile hasn't covered yet in its household themes challenge,
 * those most like what it enjoys first (lib/themeRanking.ts: `seeds` are Discover's taste seeds).
 */
export function ThemeIdeas({ inLibrary, seeds }: { inLibrary: Set<string>; seeds: Seed[] }) {
  const t = useT();
  const profile = useActiveProfile();
  const data = useProfileData();
  const challenges = useChallenges();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (!profileId) return;
    let live = true;
    challenges.list().then(
      (list) => live && setChallenge(activeThemesChallenge(list, profileId, today())),
      // Ideas are extras: without the challenges there's simply no row.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [challenges, profileId]);

  if (!profile || !challenge) return null;
  const catalog = books.filter((b) => isAllowed(b.ageRating, profile.ageRating));
  const rank = themeRank({
    seeds,
    moodSeeds: moodSeeds(data.moods ?? {}, (id) => {
      const book = getBook(id);
      return book && isAllowed(book.ageRating, profile.ageRating) ? book : undefined;
    }),
    follows: data.follows,
  });
  const ideas = themeIdeas({ challenge, days: data.readingDays, catalog, bookOf: themeBookOf, skip: (id) => inLibrary.has(id), rank });
  return (
    <>
      {ideas.map((idea) => (
        <Shelf
          key={idea.themeId}
          id={`theme-${idea.themeId}`}
          eyebrow={t("For your challenge: {title}", { title: idea.challenge.title })}
          title={t(idea.label)}
          items={idea.books.map(fromLocal)}
        />
      ))}
    </>
  );
}
