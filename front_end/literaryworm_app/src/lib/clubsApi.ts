import { AccountError, callFunction, signedInUserId } from "./accountApi";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { type ClubMeeting, MEETING_ALERT_MS, type RsvpAnswer, type UpcomingMeeting } from "./clubCalendar";
import type { Club, ClubDetail, ClubMembership, ClubPost, ClubPostEvent } from "./clubs";
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

type MeetingRow = {
  id: string;
  club_id: string;
  starts_at: string;
  minutes: number;
  title: string;
  note: string | null;
  time_zone: string;
  club_meeting_rsvps?: { user_id: string; answer: RsvpAnswer }[];
};
const MEETING_COLUMNS = "id, club_id, starts_at, minutes, title, note, time_zone, club_meeting_rsvps(user_id, answer)";
const toMeeting = (row: MeetingRow): ClubMeeting => ({
  id: row.id,
  clubId: row.club_id,
  startsAt: new Date(row.starts_at).toISOString(),
  minutes: row.minutes,
  title: row.title,
  note: row.note,
  timeZone: row.time_zone,
  rsvps: Object.fromEntries((row.club_meeting_rsvps ?? []).map((r) => [r.user_id, r.answer])),
});

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
  const [club, members, posts, meetings] = await Promise.all([
    db.from("book_clubs").select(CLUB_COLUMNS).eq("id", id).maybeSingle(),
    db.from("club_members").select("user_id, joined_at, member:profiles(display_name)").eq("club_id", id).order("joined_at"),
    db.from("club_posts").select(POST_COLUMNS).eq("club_id", id).order("created_at"),
    db.from("club_meetings").select(MEETING_COLUMNS).eq("club_id", id).gte("starts_at", new Date(Date.now() - 4 * 3_600_000).toISOString()).order("starts_at"),
  ]);
  if (club.error || members.error || posts.error || meetings.error) throw new AccountError("We couldn't load this club. Try again.");
  if (!club.data) return null;
  return {
    club: toClub(club.data as unknown as ClubRow),
    members: (members.data as unknown as { user_id: string; member: { display_name: string } | null }[]).map((m) => ({
      userId: m.user_id,
      name: m.member?.display_name ?? "A member",
    })),
    posts: (posts.data as unknown as PostRow[]).map(toPost),
    meetings: (meetings.data as MeetingRow[]).map(toMeeting),
  };
}

/** Schedules a meeting (the club's owner only; the database checks the time and the limit). */
export async function addMeeting(meeting: Omit<ClubMeeting, "id"> & { id: string }): Promise<ClubMeeting> {
  const { data, error } = await client()
    .from("club_meetings")
    .insert({
      id: meeting.id,
      club_id: meeting.clubId,
      starts_at: meeting.startsAt,
      minutes: meeting.minutes,
      title: meeting.title,
      note: meeting.note,
      time_zone: meeting.timeZone,
      created_by: await signedInUserId(),
    })
    .select(MEETING_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("20 upcoming")) throw new AccountError("A club can have up to 20 upcoming meetings. Cancel one to add another.");
    if (error.message.includes("still to come") || error.message.includes("year ahead")) throw new AccountError(`${error.message}.`);
    throw new AccountError("We couldn't schedule the meeting. Only the person who started the club can. Try again.");
  }
  return toMeeting(data as MeetingRow);
}

/** Changes a meeting (the club's owner only). A new time emails the members (club_meeting_changes). */
export async function updateMeeting(meeting: ClubMeeting): Promise<ClubMeeting> {
  const { data, error } = await client()
    .from("club_meetings")
    .update({ starts_at: meeting.startsAt, minutes: meeting.minutes, title: meeting.title, note: meeting.note, time_zone: meeting.timeZone })
    .eq("id", meeting.id)
    .select(MEETING_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("still to come") || error.message.includes("year ahead")) throw new AccountError(`${error.message}.`);
    throw new AccountError("We couldn't change the meeting. Only the person who started the club can. Try again.");
  }
  return toMeeting(data as MeetingRow);
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await client().from("club_meetings").delete().eq("id", id);
  if (error) throw new AccountError("We couldn't cancel the meeting. Try again.");
}

/** Answers a meeting for the signed-in member (null takes the answer back); through answer_club_meeting(). */
export async function answerMeeting(id: string, answer: RsvpAnswer | null): Promise<void> {
  const { error } = await client().rpc("answer_club_meeting", { p_meeting: id, p_answer: answer });
  if (error) {
    if (error.message.includes("already started")) throw new AccountError("This meeting has already started.");
    throw new AccountError("We couldn't save your answer. Try again.");
  }
}

/** Meetings in the member's clubs starting in the next day, for the bell. */
export async function loadSoonMeetings(): Promise<UpcomingMeeting[]> {
  const now = Date.now();
  const { data, error } = await client()
    .from("club_meetings")
    .select(`${MEETING_COLUMNS}, club:book_clubs(name)`)
    .gt("starts_at", new Date(now).toISOString())
    .lte("starts_at", new Date(now + MEETING_ALERT_MS).toISOString())
    .order("starts_at")
    .limit(20);
  if (error) throw new AccountError("We couldn't check your club meetings.");
  return (data as unknown as (MeetingRow & { club: { name: string } | null })[]).map((row) => ({ ...toMeeting(row), clubName: row.club?.name ?? "Your book club" }));
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

/**
 * Emails an invitation to join a club through the `club-invite` function, which checks the
 * caller is in the club and keeps only a fingerprint of the address.
 */
export async function inviteByEmail(clubId: string, email: string): Promise<void> {
  await callFunction<{ sent: true }>("club-invite", { clubId, email: email.trim() }, "We couldn't send the invitation. Try again.");
}

/**
 * The member's subscribe link for a club's meetings (the club-calendar function signs it). Calendar
 * apps read it on their own; it stops working if the member leaves the club.
 */
export async function calendarFeedUrl(clubId: string): Promise<string> {
  const { url } = await callFunction<{ url: string }>("club-calendar", { clubId }, "We couldn't make the calendar link. Try again.");
  return url;
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

/** This account's notify setting and unread posts in each of its clubs, keyed by club id. */
export async function loadMemberships(): Promise<Record<string, ClubMembership>> {
  const db = client();
  const me = await signedInUserId();
  const [members, unread] = await Promise.all([
    db.from("club_members").select("club_id, notify").eq("user_id", me),
    db.rpc("club_unread"),
  ]);
  if (members.error || unread.error) throw new AccountError("We couldn't check your clubs for new posts.");
  const out: Record<string, ClubMembership> = {};
  for (const m of members.data as { club_id: string; notify: boolean }[]) out[m.club_id] = { notify: m.notify, unread: {} };
  for (const u of unread.data as { club_id: string; chapter_index: number; posts: number }[]) {
    const membership = out[u.club_id];
    if (membership) membership.unread[u.chapter_index] = Number(u.posts);
  }
  return out;
}

/** Marks a club read now (its posts so far stop counting as new). */
export async function markClubRead(id: string): Promise<void> {
  const { error } = await client().rpc("mark_club_read", { p_club_id: id });
  if (error) throw new AccountError("We couldn't mark the club read.");
}

/** Turns alerts about a club's new posts on or off for this account. */
export async function setClubNotify(id: string, notify: boolean): Promise<void> {
  const { error } = await client().from("club_members").update({ notify }).eq("club_id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't change that setting. Try again.");
}

/**
 * Calls `onPost` for each new post in any of this account's clubs (RLS sends only those),
 * with its author's name. Returns a function that stops listening.
 */
export function watchClubPosts(onPost: (event: ClubPostEvent) => void): () => void {
  const db = client();
  const channel: RealtimeChannel = db
    .channel("club-posts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "club_posts" }, (payload) => {
      const row = payload.new as { id: string; club_id: string };
      // The change carries no author name: read the post back, as the discussion does.
      db.from("club_posts")
        .select(POST_COLUMNS)
        .eq("id", row.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error("clubs: couldn't read a new post", error.message);
          else if (data) onPost({ clubId: row.club_id, post: toPost(data as unknown as PostRow) });
        });
    })
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
