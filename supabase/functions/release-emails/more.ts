// The other kinds of notification the hourly run sends (migration 6550): a club meeting in the next
// day, new club posts up to the reader's chapter, and the evening streak nudge. Each kind is
// claimed once in the database; the account chooses the kinds (account_private.push_kinds).

import { type EmailLanguage, translator } from "../_shared/emailI18n.ts";
import type { PushMessage } from "../_shared/webpush.ts";
import { type DeviceDeps, deliver, PUSH_BATCH, type PushTally } from "./push.ts";

export interface DueMeeting {
  userId: string;
  clubId: string;
  clubName: string;
  title: string;
  startsAt: string;
  /** The account's email language, also used for its notifications; English when absent. */
  language?: EmailLanguage;
}

export interface DuePosts {
  userId: string;
  clubId: string;
  clubName: string;
  /** 0-based: the furthest chapter the new posts are about. */
  lastChapter: number;
  posts: number;
  authors: string[];
  /** The account's email language, also used for its notifications; English when absent. */
  language?: EmailLanguage;
}

export interface DueStreak {
  userId: string;
  profileName: string;
  days: number;
  /** The account's email language, also used for its notifications; English when absent. */
  language?: EmailLanguage;
}

export interface MoreDeps extends DeviceDeps {
  meetings: (max: number) => Promise<DueMeeting[]>;
  posts: (max: number) => Promise<DuePosts[]>;
  streaks: (max: number) => Promise<DueStreak[]>;
  now?: () => number;
}


/** "Volume one, in 5 hours": no clock time, so it's right in any time zone. */
export function meetingPush(m: DueMeeting, now: number): PushMessage {
  const t = translator(m.language ?? "en");
  const hours = Math.max(1, Math.round((Date.parse(m.startsAt) - now) / 3_600_000));
  return {
    title: `${m.clubName}: ${m.title}`,
    body: hours === 1 ? t("The club meets in about 1 hour. Tap to see the meeting.") : t("The club meets in about {hours} hours. Tap to see the meeting.", { hours }),
    url: `/clubs/${encodeURIComponent(m.clubId)}`,
    tag: `meeting-${m.clubId}`,
  };
}

/** Who wrote and how many, never what they wrote. */
export function postsPush(p: DuePosts): PushMessage {
  const t = translator(p.language ?? "en");
  const who =
    p.authors.length > 2
      ? t("{names} and others", { names: p.authors.slice(0, 2).join(", ") })
      : p.authors.length === 2
        ? t("{list} and {last}", { list: p.authors[0], last: p.authors[1] })
        : (p.authors[0] ?? "");
  const vars = { count: p.posts, chapter: p.lastChapter + 1, who };
  return {
    title: t("New in {club}", { club: p.clubName }),
    body: p.posts === 1 ? t("1 new post up to chapter {chapter}, from {who}.", vars) : t("{count} new posts up to chapter {chapter}, from {who}.", vars),
    url: `/clubs/${encodeURIComponent(p.clubId)}`,
    tag: `posts-${p.clubId}`,
  };
}

export function streakPush(s: DueStreak): PushMessage {
  const t = translator(s.language ?? "en");
  return {
    title: t("{days} days in a row", { days: s.days }),
    body: t("{name} hasn't read yet today. A few minutes keeps the streak going.", { name: s.profileName }),
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
