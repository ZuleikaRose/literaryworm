import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { onClubPost } from "./clubEvents";
import { bellCount, type ClubNews, clubNews, releasedReminders } from "./notifications";
import { renewalReminder, yearlyOffer } from "./billing";
import { type MeetingAlert, meetingAlerts } from "./clubCalendar";
import { type PollAlert, pollAlerts } from "./clubPolls";
import { type ScheduleAlert, scheduleAlerts } from "./clubSchedule";
import { clubBook } from "./clubs";
import { getBook } from "../data/books";
import * as clubsApi from "./clubsApi";
import { demoPollsFor } from "./useClubPolls";
import { goalAlerts } from "./goals";
import { badgeAlerts, badges } from "./achievements";
import { today } from "./reading";
import { listeningAlert } from "./planLimits";
import { useNaturalVoiceUsage } from "./useNaturalVoice";
import { useClubs } from "./useClubs";
import { requestAlerts, waitingRequests } from "./bookRequests";
import { tr } from "./i18n";

/**
 * The notification bell for the active profile (lib/notifications.ts works out what counts).
 * Club posts are read again when one arrives, when the tab comes back and when the member
 * leaves a club's page (which marks it read). Opening the bell marks the releases seen:
 * members' time is set by the database, so every device agrees; the demo keeps it in memory.
 */
export function useNotifications() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const clubs = useClubs();
  const { pathname } = useLocation();
  const progress = activeReading(state).progress;
  const withClubs = Boolean(profile && profile.ageRating !== "kids");
  const remote = Boolean(state.account?.userId);
  const [news, setNews] = useState<ClubNews[]>([]);
  // Club meetings starting within a day (clubs with alerts on, unless the reader can't make it).
  const [meetings, setMeetings] = useState<MeetingAlert[]>([]);
  // Open club polls this member hasn't voted in (clubs with alerts on; not ones they started).
  const [polls, setPolls] = useState<PollAlert[]>([]);
  // This week's chapters in clubs with a reading schedule, until they're read.
  const [schedules, setSchedules] = useState<ScheduleAlert[]>([]);
  // The time goals and the renewal are judged at: when the bell mounts, and again when the tab comes back.
  const [now, setNow] = useState(() => Date.now());

  const latest = useRef(progress);
  const uploadsRef = useRef(data.uploads);
  useEffect(() => {
    latest.current = progress;
    uploadsRef.current = data.uploads;
  });

  const refresh = useCallback(async () => {
    if (!withClubs) return;
    try {
      const [list, memberships, soon, me] = await Promise.all([clubs.list(), clubs.memberships(), clubs.soonMeetings(), clubs.myId()]);
      setNews(clubNews(list, memberships, latest.current, uploadsRef.current));
      setMeetings(meetingAlerts(soon, (clubId) => memberships[clubId]?.notify === false, me));
      setSchedules(
        scheduleAlerts(
          list,
          (clubId) => memberships[clubId]?.notify === false,
          (clubId) => {
            const club = list.find((c) => c.id === clubId);
            const book = club ? clubBook(club, uploadsRef.current, getBook) : undefined;
            if (!book) return null;
            const p = latest.current[book.id];
            return { place: p ? (p.finished ? book.chapters.length - 1 : p.chapterIndex) : -1, chapters: book.chapters.length };
          },
          today(),
        ),
      );
      const open = remote
        ? await clubsApi.loadOpenPolls()
        : list.flatMap((c) => demoPollsFor(c.id).filter((p) => p.closedAt === null).map((poll) => ({ poll, clubName: c.name })));
      const names = new Map(open.map((o) => [o.poll.clubId, o.clubName]));
      setPolls(pollAlerts(open.map((o) => o.poll), (clubId) => memberships[clubId]?.notify === false, me, (clubId) => names.get(clubId) ?? tr("Your book club")));
    } catch (err) {
      console.error("notifications: couldn't check book clubs:", err instanceof Error ? err.message : err);
    }
  }, [withClubs, clubs, remote]);

  useEffect(() => {
    void refresh();
    const stop = onClubPost(() => void refresh());
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
      setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, profile?.id]);

  // Leaving a club's page marks its posts read, so count again.
  const previous = useRef(pathname);
  useEffect(() => {
    if (/^\/clubs\/[^/]+$/.test(previous.current) && previous.current !== pathname) void refresh();
    previous.current = pathname;
  }, [pathname, refresh]);

  const seenAt = data.notificationsSeenAt;
  const released = useMemo(() => releasedReminders(data.reminders), [data.reminders]);
  // Kids profiles have no clubs; a profile switched to one keeps nothing from the last.
  const shownNews = withClubs ? news : [];
  const shownMeetings = withClubs ? meetings : [];
  const shownPolls = withClubs ? polls : [];
  const shownSchedules = withClubs ? schedules : [];
  // Most of the month's listening used (Basic and Standard); a grown-up's concern, so not on Kids profiles.
  const planId = state.account?.planId ?? null;
  const listening = useMemo(
    () => (withClubs ? listeningAlert(planId, state.profiles.map((p) => state.profileData[p.id]?.readingDays ?? {})) : null),
    [withClubs, planId, state.profiles, state.profileData],
  );
  // A yearly membership's renewal, 30 days ahead; for the grown-ups too.
  const account = state.account;
  const renewal = useMemo(() => (withClubs ? renewalReminder(account, now) : null), [withClubs, account, now]);
  // A monthly member nearly a year in: what paying yearly would save.
  const offer = useMemo(() => (withClubs ? yearlyOffer(account, now) : null), [withClubs, account, now]);
  // Streak about to end, close to this year's goal, goal reached: every profile, Kids included.
  const goals = useMemo(
    () => goalAlerts(data.readingDays, data.readingGoals, today(new Date(now)), new Date(now)),
    [data.readingDays, data.readingGoals, now],
  );
  // Badges earned in the last week (lib/achievements.ts): every profile, Kids included.
  const highlights = activeReading(state).highlights;
  const newBadges = useMemo(
    () => badgeAlerts(badges({ readingDays: data.readingDays, readingGoals: data.readingGoals, words: data.words, highlights }), now),
    [data.readingDays, data.readingGoals, data.words, highlights, now],
  );
  // Kids profiles' book requests waiting for an answer: for the grown-ups.
  const requests = useMemo(
    () => (withClubs ? requestAlerts(waitingRequests(state.profiles, state.profileData)) : []),
    [withClubs, state.profiles, state.profileData],
  );
  // Most of this month's natural-voice reading used (a member's grown-up and teen profiles; the hook skips Kids).
  const naturalUsage = useNaturalVoiceUsage();
  const natural = useMemo(
    () => (withClubs && naturalUsage?.mostlyUsedAt ? { at: naturalUsage.mostlyUsedAt, used: naturalUsage.used, limit: naturalUsage.limit } : null),
    [withClubs, naturalUsage],
  );
  const count = bellCount(data.reminders, seenAt, shownNews, data.authorNews, undefined, listening, [
    ...(natural ? [natural] : []),
    ...goals,
    ...newBadges,
    ...(renewal ? [renewal] : []),
    ...(offer ? [offer] : []),
    ...shownMeetings,
    ...shownPolls,
    ...shownSchedules,
    ...requests,
  ]);

  const markSeen = useCallback(async () => {
    if (!profile) return;
    const profileId = profile.id;
    try {
      const at = remote ? await accountApi.markNotificationsSeen(profileId) : Date.now();
      dispatch({ type: "notificationsSeen", profileId, at });
    } catch (err) {
      console.error("notifications: couldn't mark them seen:", err instanceof Error ? err.message : err);
    }
  }, [profile, remote, dispatch]);

  return { released, authorNews: data.authorNews, news: shownNews, meetings: shownMeetings, polls: shownPolls, schedules: shownSchedules, listening, natural, renewal, offer, goals, badges: newBadges, requests, count, seenAt, withClubs, markSeen, refresh };
}
