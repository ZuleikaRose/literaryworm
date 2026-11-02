import { useCallback, useEffect, useState } from "react";
import { useStore } from "../store/context";
import type { ClubPoll } from "./clubPolls";
import * as clubsApi from "./clubsApi";
import { DEMO_USER } from "./useClubs";

/**
 * One club's polls (lib/clubPolls.ts): Supabase for members (`club_polls`, `club_poll_votes`),
 * an in-memory sample for the demo's club, kept until refresh like the rest of the demo. Votes
 * and new polls are saved first, then shown.
 */
const demoPolls = new Map<string, ClubPoll[]>();

/** The demo club's polls (Jordan, its owner, asked what to read after Pride and Prejudice). */
export function demoPollsFor(clubId: string): ClubPoll[] {
  let list = demoPolls.get(clubId);
  if (!list) {
    list =
      clubId === "demo-club"
        ? [
            {
              id: "demo-poll-1",
              clubId,
              createdBy: "demo-jordan",
              question: "What should we read after Pride and Prejudice?",
              options: ["persuasion", "jane-eyre", "middlemarch"],
              createdAt: Date.now() - 20 * 3_600_000,
              closedAt: null,
              winner: null,
              votes: { "demo-jordan": 0, "demo-priya": 1 },
            },
          ]
        : [];
    demoPolls.set(clubId, list);
  }
  return list;
}

export function useClubPolls(clubId: string) {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const [polls, setPolls] = useState<ClubPoll[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = remote ? clubsApi.loadClubPolls(clubId) : Promise.resolve(structuredClone(demoPollsFor(clubId)));
    load.then(
      (list) => live && (setPolls(list), setError(null)),
      (err: unknown) => live && setError(err instanceof Error ? err.message : "We couldn't load the club's polls."),
    );
    return () => {
      live = false;
    };
  }, [clubId, remote]);

  const change = useCallback((id: string, update: (poll: ClubPoll) => ClubPoll) => {
    setPolls((list) => (list ?? []).map((p) => (p.id === id ? update(p) : p)));
    const demo = demoPolls.get(clubId);
    if (demo) demoPolls.set(clubId, demo.map((p) => (p.id === id ? update(p) : p)));
  }, [clubId]);

  const vote = useCallback(
    async (poll: ClubPoll, choice: number | null, me: string) => {
      if (remote) await clubsApi.voteClubPoll(poll.id, choice);
      change(poll.id, (p) => {
        const votes = { ...p.votes };
        if (choice === null) delete votes[me];
        else votes[me] = choice;
        return { ...p, votes };
      });
    },
    [remote, change],
  );

  const start = useCallback(
    async (question: string, options: string[]) => {
      const poll: ClubPoll = remote
        ? await clubsApi.startClubPoll(clubId, question, options)
        : { id: crypto.randomUUID(), clubId, createdBy: DEMO_USER, question: question.trim(), options, createdAt: Date.now(), closedAt: null, winner: null, votes: {} };
      if (!remote) demoPolls.set(clubId, [poll, ...demoPollsFor(clubId)]);
      setPolls((list) => [poll, ...(list ?? [])]);
    },
    [clubId, remote],
  );

  const close = useCallback(
    async (poll: ClubPoll, winnerIfDemo: string) => {
      const winner = remote ? await clubsApi.closeClubPoll(poll.id) : winnerIfDemo;
      change(poll.id, (p) => ({ ...p, closedAt: Date.now(), winner }));
    },
    [remote, change],
  );

  const remove = useCallback(
    async (poll: ClubPoll) => {
      if (remote) await clubsApi.deleteClubPoll(poll.id);
      else demoPolls.set(clubId, demoPollsFor(clubId).filter((p) => p.id !== poll.id));
      setPolls((list) => (list ?? []).filter((p) => p.id !== poll.id));
    },
    [clubId, remote],
  );

  return { polls, error, vote, start, close, remove };
}
