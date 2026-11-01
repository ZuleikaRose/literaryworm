// The other kinds of notification the hourly run sends (migration 6550): a club meeting in the next
// day, new club posts up to the reader's chapter, and the evening streak nudge. Each kind is
// claimed once in the database; the account chooses the kinds (account_private.push_kinds).

import type { PushMessage } from "../_shared/webpush.ts";
import { type DeviceDeps, deliver, PUSH_BATCH, type PushTally } from "./push.ts";

export interface DueMeeting {
  userId: string;
  clubId: string;
  clubName: string;
  title: string;
  startsAt: string;
}

export interface DuePosts {
  userId: string;
  clubId: string;
  clubName: string;
  /** 0-based: the furthest chapter the new posts are about. */
  lastChapter: number;
  posts: number;
  authors: string[];
}

export interface DueStreak {
  userId: string;
  profileName: string;
  days: number;
}

export interface MoreDeps extends DeviceDeps {
  meetings: (max: number) => Promise<DueMeeting[]>;
  posts: (max: number) => Promise<DuePosts[]>;
  streaks: (max: number) => Promise<DueStreak[]>;
  now?: () => number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Volume one, in 5 hours": no clock time, so it's right in any time zone. */
export function meetingPush(m: DueMeeting, now: number): PushMessage {
  const hours = Math.max(1, Math.round((Date.parse(m.startsAt) - now) / 3_600_000));
  return {
    title: `${m.clubName}: ${m.title}`,
    body: `The club meets in about ${hours} ${plural(hours, "hour", "hours")}. Tap to see the meeting.`,
    url: `/clubs/${encodeURIComponent(m.clubId)}`,
    tag: `meeting-${m.clubId}`,
  };
}

/** Who wrote and how many, never what they wrote. */
export function postsPush(p: DuePosts): PushMessage {
  const who = p.authors.length > 2 ? `${p.authors.slice(0, 2).join(", ")} and others` : p.authors.join(" and ");
  return {
    title: `New in ${p.clubName}`,
    body: `${p.posts} new ${plural(p.posts, "post", "posts")} up to chapter ${p.lastChapter + 1}, from ${who}.`,
    url: `/clubs/${encodeURIComponent(p.clubId)}`,
    tag: `posts-${p.clubId}`,
  };
}

export function streakPush(s: DueStreak): PushMessage {
  return {
    title: `${s.days} days in a row`,
    body: `${s.profileName} hasn't read yet today. A few minutes keeps the streak going.`,
    url: "/library?view=goals",
    tag: "streak",
  };
}

function group<T extends { userId: string }>(rows: T[], toMessage: (row: T) => PushMessage, into: Map<string, PushMessage[]>) {
  for (const r of rows) into.set(r.userId, [...(into.get(r.userId) ?? []), toMessage(r)]);
}

/** Claims each kind, then sends them together (an account's devices are looked up once). */
export async function pushMore(deps: MoreDeps): Promise<PushTally> {
  const now = deps.now?.() ?? Date.now();
  const messages = new Map<string, PushMessage[]>();
  group(await deps.meetings(PUSH_BATCH), (m) => meetingPush(m, now), messages);
  group(await deps.posts(PUSH_BATCH), postsPush, messages);
  group(await deps.streaks(PUSH_BATCH), streakPush, messages);
  return deliver(deps, messages);
}
