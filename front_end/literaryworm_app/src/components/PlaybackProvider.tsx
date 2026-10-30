import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBook, isAllowed } from "../data/books";
import { loadDevices, sendHandoff } from "../lib/devicesApi";
import { type DeviceLink, type Playback, PlaybackContext, type PlaybackEngine, type PlaybackSnapshot, type StartAt } from "../lib/playback";
import { bookStart, chapterIntro, chapterOutro } from "../lib/playerNav";
import { chapterAt, chapterTimes, type SleepTimer } from "../lib/reading";
import { useDeviceLink } from "../lib/useDeviceLink";
import { useDailyLimit } from "../lib/useDailyLimit";
import { useListeningAllowance } from "../lib/useListeningAllowance";
import { bookText, type Narrator, type NarratorEvents, recordingNarrator, resolveNarration, speechNarrator, useVoices } from "../lib/narration";
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
  /** Where to open it, if not at the profile's place. */
  start?: StartAt;
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

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });
  const open = useCallback((book: Book, start?: StartAt) => {
    const { accountKey: account, profileId: profile } = who.current;
    if (!account || !profile) return;
    const prev = sessionRef.current;
    if (prev && prev.book.id === book.id && prev.account === account && prev.profileId === profile) {
      // Already open: go to the place asked for.
      if (start && engine.current) {
        engine.current.seek(start.at);
        if (start.autoplay) engine.current.play();
      }
      return;
    }
    const next = { book, account, profileId: profile, start };
    sessionRef.current = next;
    setSession(next);
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

  // Listening on another device: members only.
  const device = useDeviceLink(state.account?.userId ?? null);
  const { incoming, settle } = device;
  const profiles = state.profiles;
  const link = useMemo<DeviceLink>(
    () => ({
      available: Boolean(device.deviceId),
      thisDevice: device.thisDevice,
      listDevices: async () => (device.deviceId ? loadDevices(device.deviceId) : []),
      sendTo: async (target) => {
        const playing = sessionRef.current;
        const place = snapshotRef.current;
        if (!playing || !place) throw new Error("Open a book first.");
        await sendHandoff({
          toDeviceId: target.id,
          profileId: playing.profileId,
          bookId: playing.book.id,
          position: place.position,
          fromLabel: device.thisDevice,
        });
        engine.current?.pause();
      },
      incoming,
      accept: () => {
        const book = incoming ? getBook(incoming.bookId) : undefined;
        const profile = profiles.find((p) => p.id === incoming?.profileId);
        if (!incoming || !book || !profile || profile.id !== who.current.profileId || !isAllowed(book.ageRating, profile.ageRating)) return null;
        settle();
        open(book, { at: incoming.position, autoplay: true });
        return book;
      },
      dismiss: settle,
    }),
    [device.deviceId, device.thisDevice, incoming, settle, profiles, open],
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
      link,
    }),
    [active, current, open, close, pause, play, toggle, seek, setSleep, finish, restart, allowMore, addBookmark, removeBookmark, link],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {active && (
        <Engine
          key={`${active.profileId}:${active.book.id}`}
          book={active.book}
          profileId={active.profileId}
          start={active.start}
          engineRef={engine}
          onSnapshot={setSnapshot}
        />
      )}
    </PlaybackContext.Provider>
  );
}

/**
 * The clock for one open book. A narrator (lib/narration.ts) makes the sound: the book's
 * LibriVox recording or a device voice reading its text, and the clock follows it; with neither,
 * a silent sample clock runs at the chosen speed. Either way it stops when paused, at a sleep
 * timer or at the daily limit, and saves the place as it goes and as it stops. Renders nothing.
 */
function Engine({
  book,
  profileId,
  start,
  engineRef,
  onSnapshot,
}: {
  book: Book;
  profileId: string;
  start?: StartAt;
  engineRef: RefObject<PlaybackEngine | null>;
  onSnapshot: (snapshot: PlaybackSnapshot) => void;
}) {
  const { narrationVoice, player } = useProfileData();
  const speed = player.speed;
  const volume = player.muted ? 0 : player.volume / 100;
  const { autoSkipIntro, autoSkipOutro } = player;
  const reading = useReading(book, profileId);
  // Stable for the book, so the effects below run when something actually changes.
  const { starts, total } = useMemo(() => chapterTimes(book), [book]);
  const lengths = useMemo(() => book.chapters.map((c) => c.minutes * 60), [book]);

  const [position, setPosition] = useState(() =>
    start
      ? Math.min(total - 1, Math.max(0, start.at))
      : reading.progress && !reading.progress.finished
        ? Math.min(total, reading.progress.fraction * total)
        : 0,
  );
  // A book sent from another device carries on playing (the narrator starts once it's ready).
  const [playing, setPlaying] = useState(start?.autoplay ?? false);
  const [sleep, setSleep] = useState<SleepTimer>(null);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const limit = useDailyLimit(playing, profileId, true);
  const allowance = useListeningAllowance(playing);
  const { reached: allowanceReached, hours: allowanceHours, planId: allowancePlan, planName, resumesOn, leftSeconds } = allowance;
  // Whole minutes, so the snapshot changes once a minute rather than every step.
  const leftMinutes = leftSeconds === null ? null : Math.floor(leftSeconds / 60);
  const listeningLeft = useMemo(
    () => (leftMinutes === null || allowanceHours === null ? null : { seconds: leftMinutes * 60, hours: allowanceHours }),
    [leftMinutes, allowanceHours],
  );
  const allowanceUsed = useMemo(
    () => (allowanceReached && allowanceHours !== null ? { planId: allowancePlan, planName, hours: allowanceHours, resumesOn } : null),
    [allowanceReached, allowanceHours, allowancePlan, planName, resumesOn],
  );

  const save = (seconds: number, finishedNow = false) =>
    reading.save({
      format: "audiobook",
      fraction: finishedNow ? 1 : seconds / total,
      chapterIndex: chapterAt(starts, seconds),
      finished: finishedNow,
    });

  const running = playing && !limit.reached && !allowance.reached;
  const narrator = useRef<Narrator | null>(null);

  /**
   * A chapter has been heard to its end (or to its outro, when outros are skipped): go on to the
   * next one (after its intro, when intros are skipped), or finish the book after the last.
   */
  const endChapter = (index: number) => {
    const c = clock.current;
    if (index >= starts.length - 1) {
      c.position = total;
      setPosition(total);
      setPlaying(false);
      setFinished(true);
      c.save(total, true);
      return;
    }
    const next = starts[index + 1] + (c.autoSkipIntro ? chapterIntro(book, index + 1) : 0);
    c.position = next;
    setPosition(next);
    narrator.current?.cue(next);
    if (c.sleep?.kind === "chapter") {
      setSleep(null);
      setPlaying(false);
      setNotice("Sleep timer: paused at the end of the chapter.");
      c.save(next);
      return;
    }
    narrator.current?.start();
  };

  const clock = useRef({ position, speed, volume, sleep, sleepLeft, running, autoSkipIntro, autoSkipOutro, sinceSave: 0, save, endChapter });
  useEffect(() => {
    clock.current = { ...clock.current, position, speed, volume, sleep, sleepLeft, running, autoSkipIntro, autoSkipOutro, save, endChapter };
  });

  // Who reads: the recording, a device voice (once the book's text has loaded), or nobody.
  const voices = useVoices();
  const narration = resolveNarration(book, narrationVoice, voices);
  const voice = narration.kind === "speech" ? narration.voice : null;
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });
  const narrationKey = voice ? voice.voiceURI : narration.kind;
  const [text, setText] = useState<string[] | null>(null);
  useEffect(() => {
    if (narration.kind !== "speech") return;
    let live = true;
    bookText(book).then(
      (chapters) => live && setText(chapters),
      (err: Error) => live && setNotice(err.message),
    );
    return () => {
      live = false;
    };
  }, [narration.kind, book]);

  useEffect(() => {
    const loading = "Loading the narration…";
    const events: NarratorEvents = {
      onChapterEnd: (index) => clock.current.endChapter(index),
      onWaiting: () => setNotice((n) => n ?? loading),
      onPlaying: () => setNotice((n) => (n === loading ? null : n)),
      onError: (message) => {
        setPlaying(false);
        setNotice(message);
      },
    };
    const v = voiceRef.current;
    const n =
      narrationKey === "recording" && book.recording
        ? recordingNarrator(book.recording.tracks, starts, events)
        : v && text
          ? speechNarrator(text, starts, lengths, v, events)
          : null;
    if (!n) return;
    const c = clock.current;
    n.setRate(c.speed);
    n.setVolume(c.volume);
    n.cue(c.position);
    narrator.current = n;
    // A new voice picked while playing carries on from the same place.
    if (c.running) n.start();
    return () => {
      n.dispose();
      if (narrator.current === n) narrator.current = null;
    };
  }, [narrationKey, text, book, starts, lengths, total]);

  const seek = (seconds: number) => {
    const next = Math.min(total, Math.max(0, seconds));
    setPosition(next);
    save(next);
    const n = narrator.current;
    if (n) {
      const resume = n.isPlaying();
      n.cue(next);
      if (resume && !n.isPlaying()) n.start();
    }
  };

  // The narrator follows `running`: the daily limit, a sleep timer or Pause all stop it here.
  useEffect(() => {
    const n = narrator.current;
    if (!n) return;
    if (!running) n.stop();
    else if (!n.isPlaying()) n.start();
  }, [running]);

  useEffect(() => {
    narrator.current?.setRate(speed);
  }, [speed]);

  useEffect(() => {
    narrator.current?.setVolume(volume);
  }, [volume]);

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
      const heard = narrator.current?.position() ?? null;
      const next = Math.min(total, heard ?? c.position + elapsed * c.speed);
      c.sinceSave += elapsed * c.speed;

      // A narrator says when a chapter ends (onChapterEnd); the silent clock checks here. A
      // skipped outro ends the chapter early either way.
      const index = chapterAt(starts, c.position);
      const outro = c.autoSkipOutro ? chapterOutro(book, index) : 0;
      const boundary = (index === starts.length - 1 ? total : starts[index + 1]) - outro;
      if ((heard === null || outro > 0) && next >= boundary && c.position < boundary) {
        c.endChapter(index);
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
      if (heard === null && next >= total) {
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
  }, [running, total, starts, book]);

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
      allowance: allowanceUsed,
      listeningLeft,
      saveError,
    });
  }, [onSnapshot, book.id, position, total, playing, finished, sleep, sleepLeft, notice, limit.reached, limit.limitMinutes, allowanceUsed, listeningLeft, saveError]);

  // The controls, for the provider to call. Kept current with the latest render.
  const latest = useRef({ position, seek, reading, limit, allowance, finished });
  useEffect(() => {
    latest.current = { position, seek, reading, limit, allowance, finished };
  });
  useEffect(() => {
    const api: PlaybackEngine = {
      play: () => {
        const l = latest.current;
        setNotice(null);
        if (l.finished || l.position >= total) {
          setFinished(false);
          l.seek(bookStart(book, clock.current.autoSkipIntro));
        } else if (clock.current.autoSkipIntro && starts.includes(l.position)) {
          // Starting from the very start of a chapter: past its intro.
          l.seek(l.position + chapterIntro(book, chapterAt(starts, l.position)));
        }
        // Started here, inside the click, because browsers block sound that starts later.
        if (!l.limit.reached && !l.allowance.reached) narrator.current?.start();
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
        latest.current.seek(bookStart(book, clock.current.autoSkipIntro));
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
  }, [engineRef, total, book, starts]);

  return null;
}
