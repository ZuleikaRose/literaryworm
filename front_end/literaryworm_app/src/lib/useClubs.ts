import { useCallback, useMemo } from "react";
import { useActiveProfile, useStore } from "../store/context";
import { AccountError } from "./accountApi";
import { type ClubMeeting, MEETING_ALERT_MS, type RsvpAnswer, type UpcomingMeeting } from "./clubCalendar";
import type { Club, ClubDetail, ClubMembership, ClubPost } from "./clubs";
import * as clubsApi from "./clubsApi";
import { today } from "./reading";

/** The demo's own id in its sample club. */
export const DEMO_USER = "demo-you";

/**
 * The demo household's clubs: one sample club, kept in memory like the rest of the demo, so
 * it resets on refresh. Members use Supabase (clubsApi); the demo can't reach other people.
 */
type DemoClub = ClubDetail;
let demoClubs: DemoClub[] | null = null;
/** The demo's own settings in each club: alerts on, and last looked two days ago (so a post is new). */
const demoMeta = new Map<string, { notify: boolean; lastReadAt: number }>();
const demoMetaFor = (id: string) => {
  let meta = demoMeta.get(id);
  if (!meta) demoMeta.set(id, (meta = { notify: true, lastReadAt: Date.now() - 48 * 3_600_000 }));
  return meta;
};

/** The next Sunday at 7 pm local time, at least two days away: the sample club's meeting. */
function nextSundayEvening(): Date {
  const date = new Date();
  date.setHours(19, 0, 0, 0);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7 || 7));
  if (date.getTime() - Date.now() < 2 * 86_400_000) date.setDate(date.getDate() + 7);
  return date;
}

function seedDemo(you: string): DemoClub[] {
  const day = (offset: number) => today(new Date(Date.now() + offset * 86_400_000));
  const at = (hoursAgo: number) => Date.now() - hoursAgo * 3_600_000;
  return [
    {
      club: {
        id: "demo-club",
        name: "Sunday Classics",
        bookId: "pride-and-prejudice",
        startsOn: day(-14),
        finishesOn: day(42),
        inviteCode: "SundayRead",
        ownerId: "demo-jordan",
        memberCount: 3,
      },
      members: [
        { userId: "demo-jordan", name: "Jordan" },
        { userId: "demo-priya", name: "Priya" },
        { userId: DEMO_USER, name: you },
      ],
      posts: [
        { id: "p1", userId: "demo-jordan", author: "Jordan", chapterIndex: 0, body: "That first line! Austen tells you the joke before the story even starts.", createdAt: at(200) },
        { id: "p2", userId: "demo-priya", author: "Priya", chapterIndex: 0, body: "Mr Bennet teasing his wife is going to be my favourite thing, I can tell.", createdAt: at(180) },
        { id: "p3", userId: "demo-jordan", author: "Jordan", chapterIndex: 2, body: "The ball. Darcy's 'tolerable' is such a bad first impression. Was he nervous or just rude?", createdAt: at(120) },
        { id: "p4", userId: "demo-priya", author: "Priya", chapterIndex: 5, body: "Charlotte's view of marriage is so practical it's almost shocking.", createdAt: at(30) },
        { id: "p5", userId: "demo-jordan", author: "Jordan", chapterIndex: 33, body: "I did NOT expect that proposal, or Elizabeth's answer. Talk when you get here!", createdAt: at(5) },
        { id: "p6", userId: "demo-priya", author: "Priya", chapterIndex: 0, body: "Rereading chapter 1 out loud. The dialogue is so quick it's almost a play.", createdAt: at(3) },
      ],
      meetings: [
        {
          id: "3c0b8f0e-6d1a-4b8e-9a5e-1d2c3b4a5f60",
          clubId: "demo-club",
          startsAt: nextSundayEvening().toISOString(),
          minutes: 60,
          title: "Volume 1: the Netherfield ball",
          note: "Video call link in the club chat. Read to the end of chapter 23 if you can.",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          rsvps: { "demo-jordan": "yes", "demo-priya": "maybe" },
        },
      ],
    },
  ];
}

const clone = <T,>(value: T): T => structuredClone(value);

/**
 * Book clubs for the active profile: Supabase for members, an in-memory sample for the demo.
 * Every call returns a promise and rejects with an Error whose message can be shown.
 */
export function useClubs() {
  const { state } = useStore();
  const profile = useActiveProfile();
  const remote = Boolean(state.account?.userId);
  const you = profile?.name ?? "You";

  const demo = useCallback(() => (demoClubs ??= seedDemo(you)), [you]);

  const myId = useCallback(async () => (remote ? clubsApi.myUserId() : DEMO_USER), [remote]);

  const list = useCallback(async (): Promise<Club[]> => {
    if (remote) return clubsApi.listClubs();
    return demo().map((c) => ({ ...c.club, memberCount: c.members.length }));
  }, [remote, demo]);

  const load = useCallback(
    async (id: string): Promise<ClubDetail | null> => {
      if (remote) return clubsApi.loadClub(id);
      const found = demo().find((c) => c.club.id === id);
      return found ? clone({ ...found, club: { ...found.club, memberCount: found.members.length } }) : null;
    },
    [remote, demo],
  );

  const create = useCallback(
    async (input: Omit<Club, "id" | "ownerId" | "memberCount">): Promise<string> => {
      const id = crypto.randomUUID();
      if (remote) {
        await clubsApi.createClub({ id, ...input });
        return id;
      }
      demo().push({ club: { ...input, id, ownerId: DEMO_USER, memberCount: 1 }, members: [{ userId: DEMO_USER, name: you }], posts: [], meetings: [] });
      return id;
    },
    [remote, demo, you],
  );

  const join = useCallback(
    async (code: string): Promise<string | null> => {
      if (remote) return clubsApi.joinClub(code);
      const found = demo().find((c) => c.club.inviteCode === code);
      if (found && !found.members.some((m) => m.userId === DEMO_USER)) found.members.push({ userId: DEMO_USER, name: you });
      return found?.club.id ?? null;
    },
    [remote, demo, you],
  );

  const invite = useCallback(
    async (clubId: string, email: string) => {
      if (!remote) throw new AccountError("The demo can't send emails. Share the club code instead.");
      await clubsApi.inviteByEmail(clubId, email);
    },
    [remote],
  );

  const leave = useCallback(
    async (id: string) => {
      if (remote) return clubsApi.leaveClub(id);
      const found = demo().find((c) => c.club.id === id);
      if (found) {
        found.members = found.members.filter((m) => m.userId !== DEMO_USER);
        found.posts = found.posts.filter((p) => p.userId !== DEMO_USER);
        if (found.members.length === 0) demoClubs = demo().filter((c) => c !== found);
      }
    },
    [remote, demo],
  );

  const remove = useCallback(
    async (id: string) => {
      if (remote) return clubsApi.deleteClub(id);
      demoClubs = demo().filter((c) => c.club.id !== id);
    },
    [remote, demo],
  );

  const addPost = useCallback(
    async (clubId: string, chapterIndex: number, body: string): Promise<ClubPost> => {
      if (remote) return clubsApi.addPost(clubId, chapterIndex, body);
      const post: ClubPost = { id: crypto.randomUUID(), userId: DEMO_USER, author: you, chapterIndex, body: body.trim(), createdAt: Date.now() };
      demo().find((c) => c.club.id === clubId)?.posts.push(post);
      return post;
    },
    [remote, demo, you],
  );

  const deletePost = useCallback(
    async (clubId: string, postId: string) => {
      if (remote) return clubsApi.deletePost(postId);
      const found = demo().find((c) => c.club.id === clubId);
      if (found) found.posts = found.posts.filter((p) => p.id !== postId);
    },
    [remote, demo],
  );

  const addMeeting = useCallback(
    async (meeting: Omit<ClubMeeting, "id" | "rsvps">): Promise<ClubMeeting> => {
      const withId = { ...meeting, id: crypto.randomUUID(), rsvps: {} };
      if (remote) return clubsApi.addMeeting(withId);
      const found = demo().find((c) => c.club.id === meeting.clubId);
      if (!found || found.club.ownerId !== DEMO_USER) throw new AccountError("Only the person who started the club can schedule meetings.");
      found.meetings.push(withId);
      return withId;
    },
    [remote, demo],
  );

  const deleteMeeting = useCallback(
    async (clubId: string, meetingId: string) => {
      if (remote) return clubsApi.deleteMeeting(meetingId);
      const found = demo().find((c) => c.club.id === clubId);
      if (found) found.meetings = found.meetings.filter((m) => m.id !== meetingId);
    },
    [remote, demo],
  );

  /** Answers a meeting for this account (null takes the answer back). */
  const answerMeeting = useCallback(
    async (clubId: string, meetingId: string, answer: RsvpAnswer | null) => {
      if (remote) return clubsApi.answerMeeting(meetingId, answer);
      const meeting = demo()
        .find((c) => c.club.id === clubId)
        ?.meetings.find((m) => m.id === meetingId);
      if (!meeting) return;
      if (answer) meeting.rsvps[DEMO_USER] = answer;
      else delete meeting.rsvps[DEMO_USER];
    },
    [remote, demo],
  );

  /** Meetings in this account's clubs starting in the next day (for the bell). */
  const soonMeetings = useCallback(async (): Promise<UpcomingMeeting[]> => {
    if (remote) return clubsApi.loadSoonMeetings();
    const now = Date.now();
    return demo()
      .filter((c) => c.members.some((m) => m.userId === DEMO_USER))
      .flatMap((c) => c.meetings.map((m) => ({ ...clone(m), clubName: c.club.name })))
      .filter((m) => Date.parse(m.startsAt) > now && Date.parse(m.startsAt) - now <= MEETING_ALERT_MS);
  }, [remote, demo]);

  /** This account's alerts setting and unread posts per club. */
  const memberships = useCallback(async (): Promise<Record<string, ClubMembership>> => {
    if (remote) return clubsApi.loadMemberships();
    const out: Record<string, ClubMembership> = {};
    for (const c of demo()) {
      if (!c.members.some((m) => m.userId === DEMO_USER)) continue;
      const meta = demoMetaFor(c.club.id);
      const unread: Record<number, number> = {};
      for (const p of c.posts) if (p.userId !== DEMO_USER && p.createdAt > meta.lastReadAt) unread[p.chapterIndex] = (unread[p.chapterIndex] ?? 0) + 1;
      out[c.club.id] = { notify: meta.notify, unread };
    }
    return out;
  }, [remote, demo]);

  const markRead = useCallback(
    async (id: string) => {
      if (remote) return clubsApi.markClubRead(id);
      demoMetaFor(id).lastReadAt = Date.now();
    },
    [remote],
  );

  const setNotify = useCallback(
    async (id: string, notify: boolean) => {
      if (remote) return clubsApi.setClubNotify(id, notify);
      demoMetaFor(id).notify = notify;
    },
    [remote],
  );

  return useMemo(
    () => ({ remote, myId, list, load, create, join, invite, leave, remove, addPost, deletePost, addMeeting, deleteMeeting, answerMeeting, soonMeetings, memberships, markRead, setNotify }),
    [remote, myId, list, load, create, join, invite, leave, remove, addPost, deletePost, addMeeting, deleteMeeting, answerMeeting, soonMeetings, memberships, markRead, setNotify],
  );
}
