import { useCallback, useMemo } from "react";
import { useActiveProfile, useStore } from "../store/context";
import type { Club, ClubDetail, ClubPost } from "./clubs";
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
      demo().push({ club: { ...input, id, ownerId: DEMO_USER, memberCount: 1 }, members: [{ userId: DEMO_USER, name: you }], posts: [] });
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

  return useMemo(
    () => ({ remote, myId, list, load, create, join, leave, remove, addPost, deletePost }),
    [remote, myId, list, load, create, join, leave, remove, addPost, deletePost],
  );
}
