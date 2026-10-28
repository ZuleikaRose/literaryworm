import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Playback, PlaybackContext, type PlaybackEngine, type PlaybackSnapshot } from "../lib/playback";
import { chapterAt, chapterTimes, type SleepTimer } from "../lib/reading";
import { useDailyLimit } from "../lib/useDailyLimit";
import { useReading } from "../lib/useReading";
import { useProfileData, useStore } from "../store/context";
import { emailKey } from "../store/state";
import type { Book } from "../types";

/** How often the sample clock ticks, and how often a playing book saves its place. */
const TICK_MS = 250;
const SAVE_EVERY_SECONDS = 15;

interface Session {
  book: Book;
  /** Who opened it: the book belongs to this account and profile. */
  account: string;
  profileId: string;
}

/**
 * Keeps one audiobook playing across pages. The player page and the mini-player are views of
 * it. A book is open for the account and profile that opened it: switching profile or signing
 * out puts it away (its place is saved to that profile first).
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const accountKey = state.account ? (state.account.userId ?? emailKey(state.account.email)) : null;
  const profileId = state.activeProfileId;
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | null>(null);
  const engine = useRef<PlaybackEngine | null>(null);

  const who = useRef({ accountKey, profileId });
  useEffect(() => {
    who.current = { accountKey, profileId };
  });

  // Only the account and profile that opened the book hear it.
  const active = session && session.account === accountKey && session.profileId === profileId ? session : null;
  const current = active && snapshot?.bookId === active.book.id ? snapshot : null;
  const snapshotRef = useRef(current);
  useEffect(() => {
    snapshotRef.current = current;
  });

  const open = useCallback((book: Book) => {
    const { accountKey: account, profileId: profile } = who.current;
    if (!account || !profile) return;
    setSession((prev) =>
      prev && prev.book.id === book.id && prev.account === account && prev.profileId === profile
        ? prev
        : { book, account, profileId: profile },
    );
  }, []);
  const close = useCallback(() => setSession(null), []);
  const pause = useCallback(() => engine.current?.pause(), []);
  const play = useCallback(() => engine.current?.play(), []);
  const toggle = useCallback(() => (snapshotRef.current?.playing ? engine.current?.pause() : engine.current?.play()), []);
  const seek = useCallback((seconds: number) => engine.current?.seek(seconds), []);
  const setSleep = useCallback((value: string) => engine.current?.setSleep(value), []);
  const finish = useCallback(() => engine.current?.finish(), []);
  const restart = useCallback(() => engine.current?.restart(), []);
  const allowMore = useCallback(() => engine.current?.allowMore(), []);
  const addBookmark = useCallback<Playback["addBookmark"]>(
    (place) => engine.current?.addBookmark(place) ?? Promise.reject(new Error("Open the book first.")),
    [],
  );
  const removeBookmark = useCallback<Playback["removeBookmark"]>(
    (id) => engine.current?.removeBookmark(id) ?? Promise.reject(new Error("Open the book first.")),
    [],
  );

  const value = useMemo<Playback>(
    () => ({
      book: active?.book ?? null,
      snapshot: current,
      open,
      close,
      pause,
      play,
      toggle,
      seek,
      setSleep,
      finish,
      restart,
      allowMore,
      addBookmark,
      removeBookmark,
    }),
    [active, current, open, close, pause, play, toggle, seek, setSleep, finish, restart, allowMore, addBookmark, removeBookmark],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {active && (
        <Engine
          key={`${active.profileId}:${active.book.id}`}
          book={active.book}
          profileId={active.profileId}
          engineRef={engine}
          onSnapshot={setSnapshot}
        />
      )}
    </PlaybackContext.Provider>
  );
}

/**
 * The clock for one open book. A book with a recording plays it (one audio element, one track
 * per chapter) and the clock follows the audio; any other book runs a silent sample clock at
 * the chosen speed. Either way it stops when paused, at a sleep timer or at the daily limit, and
 * saves the place as it goes and as it stops. Renders nothing.
 */
function Engine({
  book,
  profileId,
  engineRef,
  onSnapshot,
}: {
  book: Book;
  profileId: string;
  engineRef: RefObject<PlaybackEngine | null>;
  onSnapshot: (snapshot: PlaybackSnapshot) => void;
}) {
  const speed = useProfileData().playbackSpeed;
  const reading = useReading(book, profileId);
  // Stable for the book, so the effects below run when something actually changes.
  const { starts, total } = useMemo(() => chapterTimes(book), [book]);
  const tracks = book.recording?.tracks ?? null;

  const [position, setPosition] = useState(() =>
    reading.progress && !reading.progress.finished ? Math.min(total, reading.progress.fraction * total) : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [sleep, setSleep] = useState<SleepTimer>(null);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const limit = useDailyLimit(playing, profileId);

  const chapterIndex = chapterAt(starts, position);
  const chapterEnd = starts[chapterIndex] + book.chapters[chapterIndex].minutes * 60;

  // The recording: one audio element, playing one chapter's track at a time.
  const audio = useRef<HTMLAudioElement | null>(null);
  const loadedTrack = useRef(-1);
  useEffect(() => {
    if (!tracks) return;
    const element = new Audio();
    element.preload = "auto";
    audio.current = element;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      audio.current = null;
      loadedTrack.current = -1;
    };
  }, [tracks]);

  /** Puts the recording at `seconds` into the book, loading that chapter's track if needed. */
  const cue = useCallback(
    (seconds: number) => {
      const element = audio.current;
      if (!element || !tracks) return;
      const index = chapterAt(starts, seconds);
      if (loadedTrack.current !== index) {
        element.src = tracks[index].url;
        loadedTrack.current = index;
      }
      // Before the track's metadata loads this sets where it starts.
      element.currentTime = Math.max(0, seconds - starts[index]);
    },
    [tracks, starts],
  );

  /** Starts the audio; must run inside the click that asked for it, or browsers block it. */
  const startAudio = useCallback(() => {
    audio.current?.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return; // a pause or a new track interrupted it
      setPlaying(false);
      setNotice(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Press play to start the narration."
          : "We couldn't play the narration. Check your connection, then press play to try again.",
      );
    });
  }, []);

  const save = (seconds: number, finishedNow = false) =>
    reading.save({
      format: "audiobook",
      fraction: finishedNow ? 1 : seconds / total,
      chapterIndex: chapterAt(starts, seconds),
      finished: finishedNow,
    });

  const seek = (seconds: number) => {
    const next = Math.min(total, Math.max(0, seconds));
    setPosition(next);
    save(next);
    if (audio.current) {
      const resume = !audio.current.paused;
      cue(next);
      if (resume) startAudio();
    }
  };

  const running = playing && !limit.reached;
  const clock = useRef({ position, speed, sleep, sleepLeft, chapterEnd, sinceSave: 0, save });
  useEffect(() => {
    clock.current = { ...clock.current, position, speed, sleep, sleepLeft, chapterEnd, save };
  });

  // The audio follows `running`: the daily limit, a sleep timer or Pause all stop it here.
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (!running) element.pause();
    else if (element.paused) {
      if (loadedTrack.current < 0) cue(clock.current.position);
      startAudio();
    }
  }, [running, cue, startAudio]);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.defaultPlaybackRate = speed;
    audio.current.playbackRate = speed;
  }, [speed]);

  // The recording's own events: the next chapter, the end of the book, loading and failures.
  useEffect(() => {
    const element = audio.current;
    if (!element || !tracks) return;
    const loading = "Loading the narration…";
    let retried = false;
    const onEnded = () => {
      const c = clock.current;
      const index = loadedTrack.current;
      if (index >= tracks.length - 1) {
        c.position = total;
        setPosition(total);
        setPlaying(false);
        setFinished(true);
        c.save(total, true);
        return;
      }
      const nextStart = starts[index + 1];
      c.position = nextStart;
      setPosition(nextStart);
      cue(nextStart);
      if (c.sleep?.kind === "chapter") {
        setSleep(null);
        setPlaying(false);
        setNotice("Sleep timer: paused at the end of the chapter.");
        c.save(nextStart);
        return;
      }
      startAudio();
    };
    const onWaiting = () => setNotice((n) => n ?? loading);
    const onPlaying = () => {
      retried = false;
      setNotice((n) => (n === loading ? null : n));
    };
    const onError = () => {
      if (loadedTrack.current < 0) return;
      const at = clock.current.position;
      // The Internet Archive sometimes fails a request; one quiet retry usually fixes it.
      if (!retried) {
        retried = true;
        loadedTrack.current = -1;
        cue(at);
        startAudio();
        return;
      }
      setPlaying(false);
      setNotice("We couldn't load the narration. Check your connection, then press play to try again.");
      loadedTrack.current = -1;
    };
    element.addEventListener("ended", onEnded);
    element.addEventListener("waiting", onWaiting);
    element.addEventListener("playing", onPlaying);
    element.addEventListener("error", onError);
    return () => {
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("waiting", onWaiting);
      element.removeEventListener("playing", onPlaying);
      element.removeEventListener("error", onError);
    };
  }, [tracks, starts, total, cue, startAudio]);

  useEffect(() => {
    if (!running) return;
    const saveAt = (seconds: number, finishedNow?: boolean) => clock.current.save(seconds, finishedNow);
    // Measured, not assumed: browsers slow timers in background tabs while the audio plays on.
    let last = performance.now();
    const id = window.setInterval(() => {
      const c = clock.current;
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      last = now;
      const element = audio.current;
      const recorded = element && loadedTrack.current >= 0;
      const next = recorded
        ? Math.min(total, starts[loadedTrack.current] + element.currentTime)
        : Math.min(total, c.position + elapsed * c.speed);
      c.sinceSave += elapsed * c.speed;

      // A recording pauses at the end of its chapter's track (onEnded); the sample clock checks here.
      if (!recorded && c.sleep?.kind === "chapter" && next >= c.chapterEnd && c.position < c.chapterEnd) {
        c.position = c.chapterEnd;
        setPosition(c.chapterEnd);
        setSleep(null);
        setPlaying(false);
        setNotice("Sleep timer: paused at the end of the chapter.");
        return;
      }
      if (c.sleep?.kind === "minutes") {
        const left = c.sleepLeft - elapsed;
        if (left <= 0) {
          c.position = next;
          setPosition(next);
          setSleep(null);
          setPlaying(false);
          setNotice("Sleep timer: playback paused.");
          return;
        }
        c.sleepLeft = left;
        setSleepLeft(left);
      }
      if (!recorded && next >= total) {
        // The natural end of the book finishes it; only a drag to the end asks first.
        c.position = total;
        setPosition(total);
        setPlaying(false);
        setFinished(true);
        saveAt(total, true);
        return;
      }
      c.position = next;
      setPosition(next);
      if (c.sinceSave >= SAVE_EVERY_SECONDS) {
        c.sinceSave = 0;
        saveAt(next);
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
      const c = clock.current;
      if (c.position < total) saveAt(c.position);
    };
  }, [running, total, starts]);

  // What the views need, sent up whenever it changes.
  const saveError = reading.saveError;
  useEffect(() => {
    onSnapshot({
      bookId: book.id,
      position,
      total,
      playing,
      finished,
      sleep,
      sleepLeft,
      notice,
      limitReached: limit.reached,
      limitMinutes: limit.limitMinutes,
      saveError,
    });
  }, [onSnapshot, book.id, position, total, playing, finished, sleep, sleepLeft, notice, limit.reached, limit.limitMinutes, saveError]);

  // The controls, for the provider to call. Kept current with the latest render.
  const latest = useRef({ position, seek, reading, limit, finished });
  useEffect(() => {
    latest.current = { position, seek, reading, limit, finished };
  });
  useEffect(() => {
    const api: PlaybackEngine = {
      play: () => {
        const l = latest.current;
        setNotice(null);
        let from = l.position;
        if (l.finished || l.position >= total) {
          setFinished(false);
          l.seek(0);
          from = 0;
        }
        if (audio.current && !l.limit.reached) {
          if (loadedTrack.current !== chapterAt(starts, from)) cue(from);
          startAudio();
        }
        setPlaying(true);
      },
      pause: () => setPlaying(false),
      seek: (seconds) => latest.current.seek(seconds),
      setSleep: (value) => {
        setNotice(null);
        if (value === "off") setSleep(null);
        else if (value === "chapter") setSleep({ kind: "chapter" });
        else {
          setSleep({ kind: "minutes", minutes: Number(value) });
          setSleepLeft(Number(value) * 60);
        }
      },
      finish: () => {
        setPlaying(false);
        setPosition(total);
        setFinished(true);
        clock.current.save(total, true);
      },
      restart: () => {
        setFinished(false);
        latest.current.seek(0);
      },
      allowMore: () => {
        // Coming back with more time, the book waits paused rather than playing on by itself.
        setPlaying(false);
        latest.current.limit.allowMore();
      },
      addBookmark: (place) => latest.current.reading.addBookmark(place),
      removeBookmark: (id) => latest.current.reading.removeBookmark(id),
    };
    engineRef.current = api;
    return () => {
      if (engineRef.current === api) engineRef.current = null;
    };
  }, [engineRef, total, starts, cue, startAudio]);

  return null;
}
