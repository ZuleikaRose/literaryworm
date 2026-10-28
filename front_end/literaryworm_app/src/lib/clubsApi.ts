import { AccountError, signedInUserId } from "./accountApi";
import type { Club, ClubDetail, ClubPost } from "./clubs";
import { supabase } from "./supabase";

/**
 * Book clubs for members, through Supabase (book_clubs, club_members, club_posts; members-only
 * RLS). Joining goes through join_club(), the only way to find a club by its code. Every
 * message here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError("Book clubs need the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

type ClubRow = {
  id: string;
  name: string;
  volume_id: string;
  starts_on: string;
  finishes_on: string;
  invite_code: string;
  owner_id: string;
  club_members?: { count: number }[];
};
type PostRow = { id: string; user_id: string; chapter_index: number; body: string; created_at: string; author: { display_name: string } | null };

const CLUB_COLUMNS = "id, name, volume_id, starts_on, finishes_on, invite_code, owner_id, club_members(count)";
const POST_COLUMNS = "id, user_id, chapter_index, body, created_at, author:profiles(display_name)";

const toClub = (row: ClubRow): Club => ({
  id: row.id,
  name: row.name,
  bookId: row.volume_id,
  startsOn: row.starts_on,
  finishesOn: row.finishes_on,
  inviteCode: row.invite_code,
  ownerId: row.owner_id,
  memberCount: row.club_members?.[0]?.count ?? 1,
});

const toPost = (row: PostRow): ClubPost => ({
  id: row.id,
  userId: row.user_id,
  author: row.author?.display_name ?? "A member",
  chapterIndex: row.chapter_index,
  body: row.body,
  createdAt: Date.parse(row.created_at),
});

export async function listClubs(): Promise<Club[]> {
  const { data, error } = await client().from("book_clubs").select(CLUB_COLUMNS).order("created_at");
  if (error) throw new AccountError("We couldn't load your book clubs. Try again.");
  return (data as unknown as ClubRow[]).map(toClub);
}

/** A club with its members and posts, or null when it doesn't exist or the caller isn't in it. */
export async function loadClub(id: string): Promise<ClubDetail | null> {
  const db = client();
  const [club, members, posts] = await Promise.all([
    db.from("book_clubs").select(CLUB_COLUMNS).eq("id", id).maybeSingle(),
    db.from("club_members").select("user_id, joined_at, member:profiles(display_name)").eq("club_id", id).order("joined_at"),
    db.from("club_posts").select(POST_COLUMNS).eq("club_id", id).order("created_at"),
  ]);
  if (club.error || members.error || posts.error) throw new AccountError("We couldn't load this club. Try again.");
  if (!club.data) return null;
  return {
    club: toClub(club.data as unknown as ClubRow),
    members: (members.data as unknown as { user_id: string; member: { display_name: string } | null }[]).map((m) => ({
      userId: m.user_id,
      name: m.member?.display_name ?? "A member",
    })),
    posts: (posts.data as unknown as PostRow[]).map(toPost),
  };
}

export async function createClub(input: { id: string; name: string; bookId: string; startsOn: string; finishesOn: string; inviteCode: string }): Promise<void> {
  const { error } = await client().from("book_clubs").insert({
    id: input.id,
    owner_id: await signedInUserId(),
    name: input.name.trim(),
    volume_id: input.bookId,
    starts_on: input.startsOn,
    finishes_on: input.finishesOn,
    invite_code: input.inviteCode,
  });
  if (error) {
    if (error.message.includes("20 clubs")) throw new AccountError("An account can run up to 20 clubs. Delete one to start another.");
    throw new AccountError("We couldn't start the club. Try again.");
  }
}

/** Joins with an invite code; returns the club's id, or null for a code that doesn't match a club. */
export async function joinClub(code: string): Promise<string | null> {
  const { data, error } = await client().rpc("join_club", { p_code: code });
  if (error) {
    if (error.message.includes("full")) throw new AccountError("This club is full (50 members).");
    if (error.message.includes("Too many")) throw new AccountError("Too many tries. Wait an hour and try again.");
    throw new AccountError("We couldn't join the club. Try again.");
  }
  return (data as string | null) ?? null;
}

export async function leaveClub(id: string): Promise<void> {
  const { error } = await client().from("club_members").delete().eq("club_id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't take you out of the club. Try again.");
}

export async function deleteClub(id: string): Promise<void> {
  const { error } = await client().from("book_clubs").delete().eq("id", id);
  if (error) throw new AccountError("We couldn't delete the club. Try again.");
}

export async function addPost(clubId: string, chapterIndex: number, body: string): Promise<ClubPost> {
  const { data, error } = await client()
    .from("club_posts")
    .insert({ club_id: clubId, user_id: await signedInUserId(), chapter_index: chapterIndex, body: body.trim() })
    .select(POST_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("Too many posts")) throw new AccountError("That's a lot of posts in an hour. Wait a little and try again.");
    throw new AccountError("We couldn't post that. Try again.");
  }
  return toPost(data as unknown as PostRow);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await client().from("club_posts").delete().eq("id", id);
  if (error) throw new AccountError("We couldn't delete the post. Try again.");
}

export const myUserId = signedInUserId;
