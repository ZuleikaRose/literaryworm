import { AccountError, callFunction, signedInUserId } from "./accountApi";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { type ClubMeeting, MEETING_ALERT_MS, type RsvpAnswer, type UpcomingMeeting } from "./clubCalendar";
import type { Club, ClubDetail, ClubMembership, ClubPost, ClubPostEvent } from "./clubs";
import type { ClubHighlight } from "./clubHighlights";
import type { ClubPoll } from "./clubPolls";
import type { HighlightColor } from "../types";
import { tr } from "./i18n";
import { supabase } from "./supabase";

/**
 * Book clubs for members, through Supabase (book_clubs, club_members, club_posts; members-only
 * RLS). Joining goes through join_club(), the only way to find a club by its code. Every
 * message here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError(tr("Book clubs need the LiteraryWorm backend, which isn't set up in this copy of the app."));
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
  book_title: string | null;
  book_author: string | null;
  buddy?: boolean;
  chapters_per_week?: number | null;
  voice_minutes_per_member?: number | null;
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

const CLUB_COLUMNS = "id, name, volume_id, book_title, book_author, starts_on, finishes_on, invite_code, owner_id, buddy, chapters_per_week, voice_minutes_per_member, club_members(count)";
const POST_COLUMNS = "id, user_id, chapter_index, body, created_at, author:profiles(display_name)";

const toClub = (row: ClubRow, myCopy: string | null = null): Club => ({
  id: row.id,
  name: row.name,
  bookId: row.volume_id,
  bookTitle: row.book_title,
  bookAuthor: row.book_author,
  myCopy,
  startsOn: row.starts_on,
  finishesOn: row.finishes_on,
  inviteCode: row.invite_code,
  ownerId: row.owner_id,
  memberCount: row.club_members?.[0]?.count ?? 1,
  buddy: Boolean(row.buddy),
  chaptersPerWeek: row.chapters_per_week ?? null,
  voiceMinutesPerMember: row.voice_minutes_per_member ?? null,
});

/** The owner sets the club's chapters a week, or null for no schedule (RLS: owners only). */
export async function setClubSchedule(id: string, chaptersPerWeek: number | null): Promise<void> {
  const { error } = await client().from("book_clubs").update({ chapters_per_week: chaptersPerWeek }).eq("id", id);
  if (error) throw new AccountError(tr("We couldn't save the schedule. Try again."));
}

/** The owner gives each member natural-voice minutes a month for the club's uploaded book, or none (RLS: owners only). */
export async function setClubVoiceHours(id: string, minutes: number | null): Promise<void> {
  const { error } = await client().from("book_clubs").update({ voice_minutes_per_member: minutes }).eq("id", id);
  if (error) throw new AccountError(tr("We couldn't save the club's natural-voice hours. Try again."));
}

/** Characters of the club's gift this member used this month (their own row only). */
export async function myClubVoiceUse(clubId: string, month: string): Promise<number> {
  const { data, error } = await client().from("club_voice_usage").select("characters").eq("club_id", clubId).eq("month", month).maybeSingle();
  if (error) throw new AccountError(tr("We couldn't load the club's natural-voice hours."));
  return (data?.characters as number | undefined) ?? 0;
}

const toPost = (row: PostRow): ClubPost => ({
  id: row.id,
  userId: row.user_id,
  author: row.author?.display_name ?? "A member",
  chapterIndex: row.chapter_index,
  body: row.body,
  createdAt: Date.parse(row.created_at),
});

/** This account's own copies of uploaded club books, by club (club_members.own_copy). */
async function myCopies(): Promise<Map<string, string | null>> {
  const { data, error } = await client().from("club_members").select("club_id, own_copy").eq("user_id", await signedInUserId());
  if (error) throw new AccountError(tr("We couldn't load your book clubs. Try again."));
  return new Map((data as { club_id: string; own_copy: string | null }[]).map((m) => [m.club_id, m.own_copy]));
}

export async function listClubs(): Promise<Club[]> {
  const [{ data, error }, copies] = await Promise.all([client().from("book_clubs").select(CLUB_COLUMNS).order("created_at"), myCopies()]);
  if (error) throw new AccountError(tr("We couldn't load your book clubs. Try again."));
  return (data as unknown as ClubRow[]).map((row) => toClub(row, copies.get(row.id) ?? null));
}

/** Links (or with null, unlinks) this account's own upload as its copy of an uploaded club book. */
export async function linkOwnCopy(clubId: string, uploadId: string | null): Promise<void> {
  const { error } = await client().from("club_members").update({ own_copy: uploadId }).eq("club_id", clubId).eq("user_id", await signedInUserId());
  if (error) {
    if (error.message.includes("own uploaded")) throw new AccountError(tr("Choose one of your own uploaded books."));
    throw new AccountError(tr("We couldn't use that copy. Try again."));
  }
}

/** A club with its members and posts, or null when it doesn't exist or the caller isn't in it. */
export async function loadClub(id: string): Promise<ClubDetail | null> {
  const db = client();
  const [club, members, posts, meetings, copies] = await Promise.all([
    db.from("book_clubs").select(CLUB_COLUMNS).eq("id", id).maybeSingle(),
    db.from("club_members").select("user_id, joined_at, member:profiles(display_name)").eq("club_id", id).order("joined_at"),
    db.from("club_posts").select(POST_COLUMNS).eq("club_id", id).order("created_at"),
    db.from("club_meetings").select(MEETING_COLUMNS).eq("club_id", id).gte("starts_at", new Date(Date.now() - 4 * 3_600_000).toISOString()).order("starts_at"),
    myCopies(),
  ]);
  if (club.error || members.error || posts.error || meetings.error) throw new AccountError(tr("We couldn't load this club. Try again."));
  if (!club.data) return null;
  return {
    club: toClub(club.data as unknown as ClubRow, copies.get(id) ?? null),
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
    if (error.message.includes("20 upcoming")) throw new AccountError(tr("A club can have up to 20 upcoming meetings. Cancel one to add another."));
    if (error.message.includes("still to come") || error.message.includes("year ahead")) throw new AccountError(`${error.message}.`);
    throw new AccountError(tr("We couldn't schedule the meeting. Only the person who started the club can. Try again."));
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
    throw new AccountError(tr("We couldn't change the meeting. Only the person who started the club can. Try again."));
  }
  return toMeeting(data as MeetingRow);
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await client().from("club_meetings").delete().eq("id", id);
  if (error) throw new AccountError(tr("We couldn't cancel the meeting. Try again."));
}

/** Answers a meeting for the signed-in member (null takes the answer back); through answer_club_meeting(). */
export async function answerMeeting(id: string, answer: RsvpAnswer | null): Promise<void> {
  const { error } = await client().rpc("answer_club_meeting", { p_meeting: id, p_answer: answer });
  if (error) {
    if (error.message.includes("already started")) throw new AccountError(tr("This meeting has already started."));
    throw new AccountError(tr("We couldn't save your answer. Try again."));
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
  if (error) throw new AccountError(tr("We couldn't check your club meetings."));
  return (data as unknown as (MeetingRow & { club: { name: string } | null })[]).map((row) => ({ ...toMeeting(row), clubName: row.club?.name ?? tr("Your book club") }));
}

export async function createClub(input: { id: string; name: string; bookId: string; startsOn: string; finishesOn: string; inviteCode: string; buddy?: boolean }): Promise<void> {
  const { error } = await client().from("book_clubs").insert({
    id: input.id,
    owner_id: await signedInUserId(),
    name: input.name.trim(),
    volume_id: input.bookId,
    starts_on: input.startsOn,
    finishes_on: input.finishesOn,
    invite_code: input.inviteCode,
    buddy: Boolean(input.buddy),
  });
  if (error) {
    if (error.message.includes("20 clubs")) throw new AccountError(tr("An account can run up to 20 clubs. Delete one to start another."));
    throw new AccountError(tr("We couldn't start the club. Try again."));
  }
}

/**
 * Emails an invitation to join a club through the `club-invite` function, which checks the
 * caller is in the club and keeps only a fingerprint of the address.
 */
export async function inviteByEmail(clubId: string, email: string): Promise<void> {
  await callFunction<{ sent: true }>("club-invite", { clubId, email: email.trim() }, tr("We couldn't send the invitation. Try again."));
}

/**
 * The member's subscribe link for a club's meetings (the club-calendar function signs it). Calendar
 * apps read it on their own; it stops working if the member leaves the club.
 */
export async function calendarFeedUrl(clubId: string): Promise<string> {
  const { url } = await callFunction<{ url: string }>("club-calendar", { clubId }, tr("We couldn't make the calendar link. Try again."));
  return url;
}

/** Joins with an invite code; returns the club's id, or null for a code that doesn't match a club. */
export async function joinClub(code: string): Promise<string | null> {
  const { data, error } = await client().rpc("join_club", { p_code: code });
  if (error) {
    if (error.message.includes("two readers")) throw new AccountError(tr("This buddy read already has two readers."));
    if (error.message.includes("full")) throw new AccountError(tr("This club is full (50 members)."));
    if (error.message.includes("Too many")) throw new AccountError(tr("Too many tries. Wait an hour and try again."));
    throw new AccountError(tr("We couldn't join the club. Try again."));
  }
  return (data as string | null) ?? null;
}

export async function leaveClub(id: string): Promise<void> {
  const { error } = await client().from("club_members").delete().eq("club_id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError(tr("We couldn't take you out of the club. Try again."));
}

export async function deleteClub(id: string): Promise<void> {
  const { error } = await client().from("book_clubs").delete().eq("id", id);
  if (error) throw new AccountError(tr("We couldn't delete the club. Try again."));
}

export async function addPost(clubId: string, chapterIndex: number, body: string): Promise<ClubPost> {
  const { data, error } = await client()
    .from("club_posts")
    .insert({ club_id: clubId, user_id: await signedInUserId(), chapter_index: chapterIndex, body: body.trim() })
    .select(POST_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("Too many posts")) throw new AccountError(tr("That's a lot of posts in an hour. Wait a little and try again."));
    throw new AccountError(tr("We couldn't post that. Try again."));
  }
  return toPost(data as unknown as PostRow);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await client().from("club_posts").delete().eq("id", id);
  if (error) throw new AccountError(tr("We couldn't delete the post. Try again."));
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
  if (members.error || unread.error) throw new AccountError(tr("We couldn't check your clubs for new posts."));
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
  if (error) throw new AccountError(tr("We couldn't mark the club read."));
}

/** Turns alerts about a club's new posts on or off for this account. */
export async function setClubNotify(id: string, notify: boolean): Promise<void> {
  const { error } = await client().from("club_members").update({ notify }).eq("club_id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError(tr("We couldn't change that setting. Try again."));
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

// --- Where everyone is (lib/clubPlaces.ts) ---

/** Places of the members who show theirs. Members only (club_places()). */
export async function fetchClubPlaces(clubId: string): Promise<import("./clubPlaces").ClubPlace[]> {
  const { data, error } = await client().rpc("club_places", { p_club: clubId });
  if (error) throw new Error(tr("We couldn't load where everyone is. Try again in a moment."));
  return (data as { user_id: string; display_name: string | null; chapter_index: number; fraction: number; finished: boolean; updated_at: string }[]).map((r) => ({
    userId: r.user_id,
    name: r.display_name ?? "A member",
    chapterIndex: r.chapter_index,
    fraction: Number(r.fraction),
    finished: r.finished,
    updatedAt: Date.parse(r.updated_at),
  }));
}

/** Whether this account shows its place in the club. */
export async function loadSharePlace(clubId: string): Promise<boolean> {
  const { data, error } = await client().from("club_members").select("share_place").eq("club_id", clubId).eq("user_id", await signedInUserId()).maybeSingle();
  if (error) throw new Error(tr("We couldn't load your club settings."));
  return Boolean(data?.share_place);
}

export async function setSharePlace(clubId: string, on: boolean): Promise<void> {
  const { error } = await client().from("club_members").update({ share_place: on }).eq("club_id", clubId).eq("user_id", await signedInUserId());
  if (error) throw new Error(tr("We couldn't change that. Try again."));
}

// ---------- Shared highlights (club_highlights, migration 6565) ----------

// club_highlights has no foreign key to profiles: the author comes through the membership it belongs to.
const SHARED_COLUMNS = "id, user_id, highlight_id, chapter_index, quote, color, note, created_at, membership:club_members(member:profiles(display_name))";

interface SharedRow {
  id: string;
  user_id: string;
  highlight_id: string;
  chapter_index: number;
  quote: string;
  color: HighlightColor;
  note: string | null;
  created_at: string;
  membership: { member: { display_name: string } | null } | null;
}

const toShared = (row: SharedRow): ClubHighlight => ({
  id: row.id,
  userId: row.user_id,
  author: row.membership?.member?.display_name ?? "A member",
  highlightId: row.highlight_id,
  chapterIndex: row.chapter_index,
  quote: row.quote,
  color: row.color,
  note: row.note,
  createdAt: Date.parse(row.created_at),
});

/** The highlights members have shared with a club (members only, by RLS). */
export async function loadClubHighlights(clubId: string): Promise<ClubHighlight[]> {
  const { data, error } = await client().from("club_highlights").select(SHARED_COLUMNS).eq("club_id", clubId).order("created_at");
  if (error) throw new AccountError(tr("We couldn't load the shared highlights. Try again."));
  return (data as unknown as SharedRow[]).map(toShared);
}

/** Shares one of this account's highlights of the club's book; the database copies the passage. */
export async function shareHighlight(clubId: string, highlightId: string, shareNote: boolean): Promise<ClubHighlight> {
  const { data, error } = await client()
    .from("club_highlights")
    .insert({ club_id: clubId, user_id: await signedInUserId(), highlight_id: highlightId, share_note: shareNote })
    .select(SHARED_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("up to 300")) throw new AccountError(tr("You can share up to 300 highlights in a club."));
    if (error.code === "23505") throw new AccountError(tr("You've already shared that highlight here."));
    throw new AccountError(tr("We couldn't share that highlight. Try again."));
  }
  return toShared(data as unknown as SharedRow);
}

export async function unshareHighlight(id: string): Promise<void> {
  const { error } = await client().from("club_highlights").delete().eq("id", id);
  if (error) throw new AccountError(tr("We couldn't stop sharing that highlight. Try again."));
}

// Club polls (club_polls, club_poll_votes, migration 6637): members read their clubs' polls and
// votes; the owner starts and deletes them; votes go through vote_club_poll() and closing through
// close_club_poll().

const POLL_COLUMNS = "id, club_id, created_by, question, options, upload_labels, created_at, closed_at, winner, votes:club_poll_votes(user_id, choice)";

interface PollRow {
  id: string;
  club_id: string;
  created_by: string;
  question: string;
  options: string[];
  upload_labels?: Record<string, { title: string; author: string }> | null;
  created_at: string;
  closed_at: string | null;
  winner: string | null;
  votes: { user_id: string; choice: number }[] | null;
}

const toPoll = (row: PollRow): ClubPoll => ({
  id: row.id,
  clubId: row.club_id,
  createdBy: row.created_by,
  question: row.question,
  options: row.options,
  uploadLabels: row.upload_labels ?? {},
  createdAt: Date.parse(row.created_at),
  closedAt: row.closed_at ? Date.parse(row.closed_at) : null,
  winner: row.winner,
  votes: Object.fromEntries((row.votes ?? []).map((v) => [v.user_id, v.choice])),
});

/** A club's polls, newest first (members only, by RLS). */
export async function loadClubPolls(clubId: string): Promise<ClubPoll[]> {
  const { data, error } = await client().from("club_polls").select(POLL_COLUMNS).eq("club_id", clubId).order("created_at", { ascending: false }).limit(20);
  if (error) throw new AccountError(tr("We couldn't load the club's polls. Try again."));
  return (data as unknown as PollRow[]).map(toPoll);
}

/** Open polls in every club the member is in, with their clubs' names, for the bell. */
export async function loadOpenPolls(): Promise<{ poll: ClubPoll; clubName: string }[]> {
  const { data, error } = await client().from("club_polls").select(`${POLL_COLUMNS}, club:book_clubs(name)`).is("closed_at", null).limit(50);
  if (error) throw new AccountError(tr("We couldn't check your club polls."));
  return (data as unknown as (PollRow & { club: { name: string } | null })[]).map((row) => ({ poll: toPoll(row), clubName: row.club?.name ?? tr("Your book club") }));
}

/** Starts a poll in a club the member owns. */
export async function startClubPoll(clubId: string, question: string, options: string[]): Promise<ClubPoll> {
  const { data, error } = await client()
    .from("club_polls")
    .insert({ club_id: clubId, created_by: await signedInUserId(), question: question.trim(), options })
    .select(POLL_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new AccountError(tr("This club already has an open poll. Close it first."));
    if (error.message.includes("up to 50")) throw new AccountError(tr("A club can have up to 50 polls. Delete an old one first."));
    if (error.message.includes("different books")) throw new AccountError(tr("A poll offers 2 to 5 different books."));
    throw new AccountError(tr("We couldn't start the poll. Try again."));
  }
  return toPoll(data as unknown as PollRow);
}

/** Votes for one of the poll's books (null takes the vote back); through vote_club_poll(). */
export async function voteClubPoll(pollId: string, choice: number | null): Promise<void> {
  const { error } = await client().rpc("vote_club_poll", { p_poll: pollId, p_choice: choice });
  if (error) {
    if (error.message.includes("has closed")) throw new AccountError(tr("This poll has closed."));
    throw new AccountError(tr("We couldn't save your vote. Try again."));
  }
}

/** Closes the poll (the owner only) and returns the winning book's id; through close_club_poll(). */
export async function closeClubPoll(pollId: string): Promise<string> {
  const { data, error } = await client().rpc("close_club_poll", { p_poll: pollId });
  if (error) {
    if (error.message.includes("already closed")) throw new AccountError(tr("This poll has already closed."));
    throw new AccountError(tr("We couldn't close the poll. Try again."));
  }
  return data as string;
}

export async function deleteClubPoll(pollId: string): Promise<void> {
  const { error } = await client().from("club_polls").delete().eq("id", pollId);
  if (error) throw new AccountError(tr("We couldn't delete the poll. Try again."));
}

// Voting on the pace (club_pace_votes): members read their clubs' votes; votes go through
// vote_club_pace(), and the owner's choice of pace clears them (a trigger).

/** A club's pace votes, member id to chapters a week. */
export async function loadPaceVotes(clubId: string): Promise<Record<string, number>> {
  const { data, error } = await client().from("club_pace_votes").select("user_id, chapters_per_week").eq("club_id", clubId).limit(500);
  if (error) throw new AccountError(tr("We couldn't load the pace votes. Try again."));
  return Object.fromEntries((data as { user_id: string; chapters_per_week: number }[]).map((r) => [r.user_id, r.chapters_per_week]));
}

/** Votes for a pace (null takes the vote back). */
export async function votePace(clubId: string, chaptersPerWeek: number | null): Promise<void> {
  const { error } = await client().rpc("vote_club_pace", { p_club: clubId, p_chapters_per_week: chaptersPerWeek });
  if (error) throw new AccountError(tr("We couldn't save your vote. Try again."));
}
