import { useCallback, useMemo } from "react";
import { useStore } from "../store/context";
import { AccountError } from "./accountApi";
import { type Challenge, type ChallengeInput, CHALLENGES_MAX, defaultTitle, presetRange } from "./challenges";
import * as challengesApi from "./challengesApi";
import { today } from "./reading";

/**
 * The household's challenges: Supabase for members, an in-memory sample for the demo (one
 * challenge for this month that the first two profiles joined), which resets on refresh like
 * the rest of the demo. Every call returns a promise and rejects with an Error whose message
 * can be shown.
 */
let demoChallenges: Challenge[] | null = null;

function seedDemo(profileIds: string[]): Challenge[] {
  const range = presetRange("this-month", today());
  return [
    {
      id: "demo-challenge",
      title: defaultTitle("books", 3, range.startsOn, range.endsOn),
      kind: "books",
      target: 3,
      ...range,
      createdBy: profileIds[0] ?? null,
      participants: profileIds.slice(0, 2),
    },
  ];
}

/** Changes one demo challenge (the list exists once the view has loaded it). */
function updateDemo(id: string, change: (c: Challenge) => Challenge) {
  demoChallenges = (demoChallenges ?? []).map((c) => (c.id === id ? change(c) : c));
}

export function useChallenges() {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const profileIds = useMemo(() => state.profiles.map((p) => p.id), [state.profiles]);

  const demo = useCallback(() => (demoChallenges ??= seedDemo(profileIds)), [profileIds]);

  const list = useCallback(async (): Promise<Challenge[]> => (remote ? challengesApi.listChallenges() : structuredClone(demo())), [remote, demo]);

  const create = useCallback(
    async (profileId: string, input: ChallengeInput): Promise<Challenge> => {
      if (remote) return challengesApi.createChallenge(profileId, input);
      if (demo().length >= CHALLENGES_MAX) throw new AccountError("A household can have up to 20 challenges. Delete one that's over first.");
      const challenge: Challenge = { id: crypto.randomUUID(), ...input, title: input.title.trim(), createdBy: profileId, participants: [profileId] };
      demoChallenges = [...demo(), challenge];
      return challenge;
    },
    [remote, demo],
  );

  const join = useCallback(
    async (id: string, profileId: string) => {
      if (remote) return challengesApi.joinChallenge(id, profileId);
      updateDemo(id, (c) => (c.participants.includes(profileId) ? c : { ...c, participants: [...c.participants, profileId] }));
    },
    [remote],
  );

  const leave = useCallback(
    async (id: string, profileId: string) => {
      if (remote) return challengesApi.leaveChallenge(id, profileId);
      updateDemo(id, (c) => ({ ...c, participants: c.participants.filter((p) => p !== profileId) }));
    },
    [remote],
  );

  const remove = useCallback(
    async (id: string) => {
      if (remote) return challengesApi.deleteChallenge(id);
      demoChallenges = demo().filter((c) => c.id !== id);
    },
    [remote, demo],
  );

  return useMemo(() => ({ remote, list, create, join, leave, remove }), [remote, list, create, join, leave, remove]);
}
