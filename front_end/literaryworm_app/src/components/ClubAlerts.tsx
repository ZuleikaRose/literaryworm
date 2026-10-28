import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getBook } from "../data/books";
import { emitClubPost } from "../lib/clubEvents";
import { type Club, type ClubMembership, type ClubPostEvent, spoilerFreeUpTo } from "../lib/clubs";
import * as clubsApi from "../lib/clubsApi";
import { activeReading } from "../store/reducer";
import { useActiveProfile, useStore } from "../store/context";
import { Icon } from "./Icon";

/** How long an alert stays before it goes by itself. */
const ALERT_MS = 9000;

interface Alert {
  id: string;
  clubId: string;
  clubName: string;
  author: string;
  chapter: number;
}

/**
 * Hears new posts in a member's book clubs (Supabase Realtime) while the app is open. Each
 * goes to the club page and the club list (lib/clubEvents.ts); if the member wants alerts for
 * that club and the post is about a chapter they've reached, they get one: a notification from
 * the system when LiteraryWorm is in the background and they've allowed it, otherwise a note
 * in the corner (not over the reader or player). Not for the demo or Kids profiles.
 */
export function ClubAlerts() {
  const { state } = useStore();
  const profile = useActiveProfile();
  const userId = state.account?.userId ?? null;
  if (!userId || !profile || profile.ageRating === "kids") return null;
  return <ClubAlertsFor key={userId} userId={userId} />;
}

function ClubAlertsFor({ userId }: { userId: string }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // What the handler needs, current when a post arrives.
  const latest = useRef({ progress: activeReading(state).progress, pathname, navigate });
  useEffect(() => {
    latest.current = { progress: activeReading(state).progress, pathname, navigate };
  });

  useEffect(() => {
    let live = true;
    let clubs = new Map<string, Club>();
    let memberships: Record<string, ClubMembership> = {};
    const refresh = () =>
      Promise.all([clubsApi.listClubs(), clubsApi.loadMemberships()]).then(
        ([list, mine]) => {
          clubs = new Map(list.map((c) => [c.id, c]));
          memberships = mine;
        },
        (err: Error) => console.error("clubs: couldn't load clubs for alerts:", err.message),
      );
    const ready = refresh();

    const handle = async ({ clubId, post }: ClubPostEvent) => {
      if (post.userId === userId) return;
      // A club joined since the list loaded: load it again.
      if (!clubs.has(clubId)) await refresh();
      const club = clubs.get(clubId);
      const book = club && getBook(club.bookId);
      if (!live || !club || !book || memberships[clubId]?.notify === false) return;
      const { progress, pathname: here, navigate: go } = latest.current;
      // No spoilers: only posts about chapters this reader has reached.
      if (post.chapterIndex > spoilerFreeUpTo(progress[book.id], book)) return;
      // The club's page is open and shows the post itself.
      if (here === `/clubs/${clubId}` && document.visibilityState === "visible") return;
      const chapter = post.chapterIndex + 1;
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        // The author and chapter only: the post itself stays inside the app.
        try {
          const note = new Notification(`New post in ${club.name}`, { body: `${post.author} wrote about chapter ${chapter}.`, icon: "/icons/icon-192.png", tag: post.id });
          note.onclick = () => {
            window.focus();
            go(`/clubs/${clubId}`);
            note.close();
          };
          return;
        } catch (err) {
          // Some browsers (Android Chrome) only show notifications from a service worker: fall
          // back to the alert in the corner, which the member sees when they come back.
          console.error("clubs: couldn't show a system notification:", err);
        }
      }
      setAlerts((list) => [...list.slice(-2), { id: post.id, clubId, clubName: club.name, author: post.author, chapter }]);
    };

    const stop = clubsApi.watchClubPosts((event) => {
      emitClubPost(event);
      void ready.then(() => handle(event));
    });
    return () => {
      live = false;
      stop();
    };
  }, [userId]);

  // Each alert goes by itself after a while.
  useEffect(() => {
    if (!alerts.length) return;
    const id = window.setTimeout(() => setAlerts((list) => list.slice(1)), ALERT_MS);
    return () => window.clearTimeout(id);
  }, [alerts]);

  // Not over the reader or the player, where the member is busy with the book.
  const immersive = /^\/(read|listen)\//.test(pathname);
  return (
    <div className="club-alerts" role="status" aria-live="polite">
      {!immersive &&
        alerts.map((a) => (
          <div key={a.id} className="club-alert">
            <Icon name="users" size={18} />
            <p>
              <strong>{a.author}</strong> posted in {a.clubName} about chapter {a.chapter}.{" "}
              <Link to={`/clubs/${a.clubId}`} onClick={() => setAlerts((list) => list.filter((x) => x.id !== a.id))}>
                Open the club
              </Link>
            </p>
            <button type="button" className="icon-button" onClick={() => setAlerts((list) => list.filter((x) => x.id !== a.id))}>
              <Icon name="close" size={16} />
              <span className="visually-hidden">Dismiss</span>
            </button>
          </div>
        ))}
    </div>
  );
}
