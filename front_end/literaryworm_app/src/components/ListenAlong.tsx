import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { type ListenAlongState, setListenAlong, useListenAlong } from "../lib/listenAlong";
import { endSession, isLeft, type ListenSession, livePosition, loadSession, moveSession, watchSession } from "../lib/listenAlongApi";
import { usePlayback } from "../lib/playback";
import { useProfileData, useStore } from "../store/context";
import type { Book } from "../types";
import { Icon } from "./Icon";

/** The host says where it is at least this often, so members know the session is still going. */
const HEARTBEAT_MS = 30_000;
/** A jump of more than this is a skip, and is sent straight away. */
const JUMP_SECONDS = 3;
/** Members follow within this much of the host; further off, they're moved. */
const DRIFT_SECONDS = 4;
/** How often a member checks they're still with the host between messages. */
const CHECK_MS = 5000;

const logFailure = (what: string) => (err: Error) => console.error(`listen along: couldn't ${what}:`, err.message);

/**
 * Keeps the playback and a club's listen-along session in step (members only), above the
 * routes so it carries on while the member browses: the host's play, pause, skips and speed go
 * to the session; members follow it. Shows a small bar saying so, with a way out.
 */
export function ListenAlong() {
  const { state } = useStore();
  const session = useListenAlong();
  const userId = state.account?.userId ?? null;

  // Signing out or switching account leaves the session.
  useEffect(() => {
    if (!userId) setListenAlong(null);
  }, [userId]);

  if (!session || !userId) return null;
  const book = getBook(session.bookId);
  if (!book) return null;
  return session.role === "host" ? <Host key={session.clubId} session={session} book={book} /> : <Follower key={session.clubId} session={session} book={book} />;
}

function Bar({ session, onLeave }: { session: ListenAlongState; onLeave: () => void }) {
  return (
    <div className="listen-along-bar" role="status">
      <Icon name="users" size={16} />
      <span>
        {session.role === "host" ? "You're leading" : "Listening along with"} <Link to={`/clubs/${session.clubId}`}>{session.clubName}</Link>
      </span>
      <button type="button" className="text-button" onClick={onLeave}>
        {session.role === "host" ? "Stop" : "Leave"}
      </button>
    </div>
  );
}

function Host({ session, book }: { session: ListenAlongState; book: Book }) {
  const playback = usePlayback();
  const { playbackSpeed } = useProfileData();
  const live = playback.book?.id === book.id ? playback.snapshot : null;
  const sent = useRef<{ position: number; playing: boolean; rate: number; at: number } | null>(null);
  const opened = useRef(false);

  // The last few places sent: Realtime echoes each back, sometimes after a newer one went out.
  const recent = useRef<{ position: number; playing: boolean; rate: number }[]>([]);
  const send = (position: number, playing: boolean) => {
    sent.current = { position, playing, rate: playbackSpeed, at: Date.now() };
    recent.current = [...recent.current.slice(-4), { position, playing, rate: playbackSpeed }];
    moveSession(session.clubId, { position, playing, rate: playbackSpeed }).catch(logFailure("update the session"));
  };
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  const stop = () => {
    setListenAlong(null);
    endSession(session.clubId).catch(logFailure("end the session"));
  };

  // Playing, pausing and changing speed go out at once; so does a skip.
  const position = live?.position ?? null;
  const playing = live?.playing ?? false;
  useEffect(() => {
    if (position === null) return;
    const last = sent.current;
    const expected = last ? last.position + (last.playing ? ((Date.now() - last.at) / 1000) * last.rate : 0) : null;
    if (!last || last.playing !== playing || last.rate !== playbackSpeed || Math.abs(position - (expected ?? position)) > JUMP_SECONDS) {
      sendRef.current(position, playing);
    }
  }, [position, playing, playbackSpeed]);

  // A heartbeat, so a host who closes the app leaves a session others can take over.
  const snapshot = useRef(live);
  useEffect(() => {
    snapshot.current = live;
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const snap = snapshot.current;
      if (snap) sendRef.current(snap.position, snap.playing);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, []);

  // Another tab (or device) leading now, or the session ended elsewhere: stop leading here, or
  // this tab's heartbeat would pull everyone back to its own place.
  useEffect(
    () =>
      watchSession(session.clubId, (s) => {
        if (!s) return setListenAlong(null);
        const ours = recent.current.some((m) => m.playing === s.playing && m.rate === s.rate && Math.abs(m.position - s.position) < 0.5);
        if (recent.current.length && !ours) setListenAlong(null);
      }),
    [session.clubId],
  );

  // Closing the book (or opening another) ends the session.
  const open = playback.book?.id === book.id;
  useEffect(() => {
    if (open) opened.current = true;
    else if (opened.current) {
      setListenAlong(null);
      endSession(session.clubId).catch(logFailure("end the session"));
    }
  }, [open, session.clubId]);

  return <Bar session={session} onLeave={stop} />;
}

function Follower({ session, book }: { session: ListenAlongState; book: Book }) {
  const playback = usePlayback();
  const { dispatch } = useStore();
  const { playbackSpeed } = useProfileData();
  const [host, setHost] = useState<ListenSession | null | undefined>(undefined);
  const opened = useRef(false);

  useEffect(() => {
    let live = true;
    loadSession(session.clubId).then((s) => live && setHost((now) => (now === undefined ? s : now)), logFailure("load the session"));
    const stop = watchSession(session.clubId, (s) => live && setHost(s));
    return () => {
      live = false;
      stop();
    };
  }, [session.clubId]);

  // Follows the host: the book, the speed, playing or paused, and the place.
  const latest = useRef({ playback, playbackSpeed, host });
  useEffect(() => {
    latest.current = { playback, playbackSpeed, host };
  });
  useEffect(() => {
    const follow = () => {
      const { playback: p, playbackSpeed: speed, host: h } = latest.current;
      if (h === undefined) return;
      if (h === null || isLeft(h)) {
        // The host stopped (or left): carry on alone, paused.
        p.pause();
        setListenAlong(null);
        return;
      }
      const at = livePosition(h);
      if (p.book?.id !== book.id) {
        // The member closed the book themselves: they've left.
        if (opened.current) return setListenAlong(null);
        opened.current = true;
        p.open(book, { at, autoplay: h.playing });
        return;
      }
      opened.current = true;
      if (h.rate !== speed) dispatch({ type: "setPlaybackSpeed", speed: h.rate });
      const snap = p.snapshot;
      if (!snap) return;
      if (h.playing && !snap.playing) p.play();
      if (!h.playing && snap.playing) p.pause();
      if (Math.abs(snap.position - at) > DRIFT_SECONDS) p.seek(at);
    };
    follow();
    const id = window.setInterval(follow, CHECK_MS);
    return () => window.clearInterval(id);
  }, [host, book, dispatch]);

  return <Bar session={session} onLeave={() => setListenAlong(null)} />;
}
