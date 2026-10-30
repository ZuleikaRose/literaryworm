import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { onClubPost } from "./clubEvents";
import { bellCount, type ClubNews, clubNews, releasedReminders } from "./notifications";
import { renewalReminder, yearlyOffer } from "./billing";
import { type MeetingAlert, meetingAlerts } from "./clubCalendar";
import { goalAlerts } from "./goals";
import { today } from "./reading";
import { listeningAlert } from "./planLimits";
import { useClubs } from "./useClubs";

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
  // The time goals and the renewal are judged at: when the bell mounts, and again when the tab comes back.
  const [now, setNow] = useState(() => Date.now());

  const latest = useRef(progress);
  useEffect(() => {
    latest.current = progress;
  });

  const refresh = useCallback(async () => {
    if (!withClubs) return;
    try {
      const [list, memberships, soon, me] = await Promise.all([clubs.list(), clubs.memberships(), clubs.soonMeetings(), clubs.myId()]);
      setNews(clubNews(list, memberships, latest.current));
      setMeetings(meetingAlerts(soon, (clubId) => memberships[clubId]?.notify === false, me));
    } catch (err) {
      console.error("notifications: couldn't check book clubs:", err instanceof Error ? err.message : err);
    }
  }, [withClubs, clubs]);

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
  const count = bellCount(data.reminders, seenAt, shownNews, data.authorNews, undefined, listening, [...goals, ...(renewal ? [renewal] : []), ...(offer ? [offer] : []), ...shownMeetings]);

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

  return { released, authorNews: data.authorNews, news: shownNews, meetings: shownMeetings, listening, renewal, offer, goals, count, seenAt, withClubs, markSeen, refresh };
}
