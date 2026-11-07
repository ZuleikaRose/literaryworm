import { useCallback, useEffect, useState } from "react";
import { useStore } from "../store/context";
import { type PaceVotes, withPaceVote } from "./clubPace";
import * as clubsApi from "./clubsApi";

/**
 * A club's pace votes (lib/clubPace.ts): Supabase for members, an in-memory sample for the demo's
 * club (Jordan and Priya have voted for the next round), kept until refresh. Votes are saved first,
 * then shown; the owner's choice of pace starts a new round (`clear()`).
 */
const demoVotes = new Map<string, PaceVotes>();

export function demoPaceVotesFor(clubId: string): PaceVotes {
  let votes = demoVotes.get(clubId);
  if (!votes) {
    votes = clubId === "demo-club" ? { "demo-jordan": 4, "demo-priya": 8 } : {};
    demoVotes.set(clubId, votes);
  }
  return votes;
}

export function useClubPace(clubId: string) {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const [votes, setVotes] = useState<PaceVotes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = remote ? clubsApi.loadPaceVotes(clubId) : Promise.resolve({ ...demoPaceVotesFor(clubId) });
    load.then(
      (v) => live && (setVotes(v), setError(null)),
      (err: unknown) => live && setError(err instanceof Error ? err.message : "We couldn't load the pace votes."),
    );
    return () => {
      live = false;
    };
  }, [clubId, remote]);

  const vote = useCallback(
    async (me: string, perWeek: number | null) => {
      if (remote) await clubsApi.votePace(clubId, perWeek);
      setVotes((v) => withPaceVote(v ?? {}, me, perWeek));
      if (!remote) demoVotes.set(clubId, withPaceVote(demoPaceVotesFor(clubId), me, perWeek));
    },
    [clubId, remote],
  );

  /** After the owner chooses a pace: the database clears the votes, so the page does too. */
  const clear = useCallback(() => {
    setVotes({});
    if (!remote) demoVotes.set(clubId, {});
  }, [clubId, remote]);

  return { votes, error, vote, clear };
}
