import { useCallback, useEffect, useState } from "react";
import { useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Highlight } from "../types";
import type { ClubHighlight } from "./clubHighlights";
import * as clubsApi from "./clubsApi";
import { DEMO_USER } from "./useClubs";

/**
 * The highlights shared with one club (lib/clubHighlights.ts): Supabase for members
 * (`club_highlights`), an in-memory sample for the demo's club, kept until refresh like the rest
 * of the demo. `share()` saves first, then shows.
 */
const demoShared = new Map<string, ClubHighlight[]>();

function demoFor(clubId: string): ClubHighlight[] {
  let list = demoShared.get(clubId);
  if (!list) {
    const at = (hoursAgo: number) => Date.now() - hoursAgo * 3_600_000;
    list =
      clubId === "demo-club"
        ? [
            {
              id: "demo-shared-1",
              userId: "demo-jordan",
              author: "Jordan",
              highlightId: "demo-jordan-h1",
              chapterIndex: 0,
              quote: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
              color: "yellow",
              note: "The most famous first line, and it's a joke.",
              createdAt: at(150),
            },
            {
              id: "demo-shared-2",
              userId: "demo-priya",
              author: "Priya",
              highlightId: "demo-priya-h1",
              chapterIndex: 33,
              quote: "In vain have I struggled. It will not do.",
              color: "pink",
              note: null,
              createdAt: at(4),
            },
          ]
        : [];
    demoShared.set(clubId, list);
  }
  return list;
}

export function useClubHighlights(clubId: string) {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const mine: Highlight[] = activeReading(state).highlights;
  const [shared, setShared] = useState<ClubHighlight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = remote ? clubsApi.loadClubHighlights(clubId) : Promise.resolve([...demoFor(clubId)]);
    load.then(
      (list) => live && (setShared(list), setError(null)),
      (err: unknown) => live && setError(err instanceof Error ? err.message : "We couldn't load the shared highlights."),
    );
    return () => {
      live = false;
    };
  }, [clubId, remote]);

  const share = useCallback(
    async (highlight: Highlight, shareNote: boolean, author: string) => {
      const added: ClubHighlight = remote
        ? await clubsApi.shareHighlight(clubId, highlight.id, shareNote)
        : {
            id: crypto.randomUUID(),
            userId: DEMO_USER,
            author,
            highlightId: highlight.id,
            chapterIndex: highlight.chapterIndex,
            quote: highlight.quote,
            color: highlight.color,
            note: shareNote ? highlight.note : null,
            createdAt: Date.now(),
          };
      if (!remote) demoFor(clubId).push(added);
      setShared((list) => [...(list ?? []), added]);
    },
    [clubId, remote],
  );

  const unshare = useCallback(
    async (id: string) => {
      if (remote) await clubsApi.unshareHighlight(id);
      else demoShared.set(clubId, demoFor(clubId).filter((h) => h.id !== id));
      setShared((list) => (list ?? []).filter((h) => h.id !== id));
    },
    [clubId, remote],
  );

  return { shared, error, mine, share, unshare };
}
