import { useEffect, useState } from "react";
import { useProfileData, useStore } from "../store/context";
import type { BookDay } from "../types";
import { loadBookDays } from "./accountApi";

/**
 * The active profile's days with one book: members' from Supabase (`book_reading_days`, read when
 * the book page opens), in-memory accounts' from `ProfileData.bookDays`. `null` while loading;
 * an error loads as no days (the statistics are an extra).
 */
export function useBookDays(bookId: string): Record<string, BookDay> | null {
  const { state } = useStore();
  const data = useProfileData();
  const member = Boolean(state.account?.userId);
  const profileId = state.activeProfileId;
  const [remote, setRemote] = useState<{ key: string; days: Record<string, BookDay> } | null>(null);
  const key = `${profileId}|${bookId}`;

  useEffect(() => {
    if (!member || !profileId) return;
    let live = true;
    loadBookDays(profileId, bookId)
      .then((days) => live && setRemote({ key, days }))
      .catch((err: unknown) => {
        console.error("stats: couldn't load the book's days", (err as Error).message);
        if (live) setRemote({ key, days: {} });
      });
    return () => {
      live = false;
    };
  }, [member, profileId, bookId, key]);

  if (!member) return data.bookDays?.[bookId] ?? {};
  return remote?.key === key ? remote.days : null;
}
