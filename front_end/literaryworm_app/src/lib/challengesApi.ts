import { AccountError, signedInUserId } from "./accountApi";
import type { Challenge, ChallengeInput } from "./challenges";
import { supabase } from "./supabase";

/**
 * Household challenges for members, through Supabase (household_challenges and
 * challenge_participants; owner-only RLS). Every message here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError("Challenges need the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

type ChallengeRow = {
  id: string;
  title: string;
  kind: Challenge["kind"];
  target: number;
  starts_on: string;
  ends_on: string;
  created_by: string | null;
  challenge_participants: { profile_id: string; joined_at: string }[];
};

const COLUMNS = "id, title, kind, target, starts_on, ends_on, created_by, challenge_participants(profile_id, joined_at)";

const toChallenge = (row: ChallengeRow): Challenge => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  target: row.target,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  createdBy: row.created_by,
  participants: [...row.challenge_participants].sort((a, b) => a.joined_at.localeCompare(b.joined_at)).map((p) => p.profile_id),
});

/** The household's challenges, soonest to end first. */
export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await client().from("household_challenges").select(COLUMNS).order("ends_on").order("created_at");
  if (error) throw new AccountError("We couldn't load your household's challenges. Try again.");
  return (data as ChallengeRow[]).map(toChallenge);
}

/** Starts a challenge and joins the profile that started it. */
export async function createChallenge(profileId: string, input: ChallengeInput): Promise<Challenge> {
  const db = client();
  const userId = await signedInUserId();
  const { data, error } = await db
    .from("household_challenges")
    .insert({
      user_id: userId,
      created_by: profileId,
      title: input.title.trim(),
      kind: input.kind,
      target: input.target,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select("id")
    .single();
  if (error) {
    throw new AccountError(
      error.code === "23514" && /20 challenges/.test(error.message)
        ? "A household can have up to 20 challenges. Delete one that's over first."
        : "We couldn't start the challenge. Try again.",
    );
  }
  await joinChallenge(data.id, profileId);
  return { id: data.id, ...input, title: input.title.trim(), createdBy: profileId, participants: [profileId] };
}

export async function joinChallenge(challengeId: string, profileId: string): Promise<void> {
  const userId = await signedInUserId();
  const { error } = await client().from("challenge_participants").insert({ challenge_id: challengeId, user_id: userId, profile_id: profileId });
  // Already joined (another device got there first) is fine.
  if (error && error.code !== "23505") throw new AccountError("We couldn't join the challenge. Try again.");
}

export async function leaveChallenge(challengeId: string, profileId: string): Promise<void> {
  const { error } = await client().from("challenge_participants").delete().eq("challenge_id", challengeId).eq("profile_id", profileId);
  if (error) throw new AccountError("We couldn't leave the challenge. Try again.");
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const { error } = await client().from("household_challenges").delete().eq("id", challengeId);
  if (error) throw new AccountError("We couldn't delete the challenge. Try again.");
}
