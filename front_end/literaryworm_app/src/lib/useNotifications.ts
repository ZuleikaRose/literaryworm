import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { onClubPost } from "./clubEvents";
import { bellCount, type ClubNews, clubNews, releasedReminders } from "./notifications";
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

  const latest = useRef(progress);
  useEffect(() => {
    latest.current = progress;
  });

  const refresh = useCallback(async () => {
    if (!withClubs) return;
    try {
      const [list, memberships] = await Promise.all([clubs.list(), clubs.memberships()]);
      setNews(clubNews(list, memberships, latest.current));
    } catch (err) {
      console.error("notifications: couldn't check book clubs:", err instanceof Error ? err.message : err);
    }
  }, [withClubs, clubs]);

  useEffect(() => {
    void refresh();
    const stop = onClubPost(() => void refresh());
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
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
  const count = bellCount(data.reminders, seenAt, shownNews);

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

  return { released, news: shownNews, count, seenAt, withClubs, markSeen, refresh };
}
