import { useEffect, useRef } from "react";
import { coverArtUrl } from "../lib/coverArt";
import { usePlayback } from "../lib/playback";
import { type PlayerControls, usePlayerControls } from "../lib/usePlayerControls";
import { useProfileData } from "../store/context";
import type { Book } from "../types";

/** The actions the lock screen, headphones and car can ask for. */
const ACTIONS: MediaSessionAction[] = ["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"];

/**
 * Puts the open audiobook on the phone's lock screen and in the system's media controls
 * (Media Session API): the cover, title and chapter, and play, pause, skip, seek and chapter
 * buttons that work from headphones, a watch or a car. The same controls as the mini-player.
 * Renders nothing.
 */
export function MediaSession() {
  const { book, snapshot } = usePlayback();
  if (!("mediaSession" in navigator) || !book || !snapshot) return null;
  return <MediaSessionView key={book.id} book={book} />;
}

function MediaSessionView({ book }: { book: Book }) {
  const playback = usePlayback();
  const controls = usePlayerControls(book);
  const playbackSpeed = useProfileData().player.speed;
  const { live, places, total, position } = controls;
  const chapter = book.chapters[places.chapterIndex];

  // Handlers are set once; they read the latest controls through this.
  const latest = useRef<{ controls: PlayerControls; playback: typeof playback }>({ controls, playback });
  useEffect(() => {
    latest.current = { controls, playback };
  });

  useEffect(() => {
    const session = navigator.mediaSession;
    const run = (action: MediaSessionAction) => (details: MediaSessionActionDetails) => {
      const { controls: c, playback: p } = latest.current;
      if (c.live?.limitReached) return;
      switch (action) {
        case "play":
          return p.play();
        case "pause":
        case "stop":
          return p.pause();
        case "seekbackward":
          return details.seekOffset ? p.seek(c.position - details.seekOffset) : c.skipBack();
        case "seekforward":
          return details.seekOffset ? p.seek(c.position + details.seekOffset) : c.skipForward();
        case "seekto":
          return details.seekTime === undefined ? undefined : p.seek(details.seekTime);
        // At the first chapter, "previous" goes back to the beginning, like a music player.
        case "previoustrack":
          return (c.previousChapter ?? c.beginning)?.();
        case "nexttrack":
          return c.nextChapter?.();
      }
    };
    for (const action of ACTIONS) {
      try {
        session.setActionHandler(action, run(action));
      } catch {
        // This browser doesn't offer that button; the rest still work.
      }
    }
    return () => {
      for (const action of ACTIONS) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Never set (see above).
        }
      }
      session.metadata = null;
      session.playbackState = "none";
    };
  }, []);

  const chapterTitle = chapter.title === `Chapter ${places.chapterIndex + 1}` ? chapter.title : `${places.chapterIndex + 1}. ${chapter.title}`;
  useEffect(() => {
    let live = true;
    const metadata = new MediaMetadata({ title: book.title, artist: book.author, album: chapterTitle });
    navigator.mediaSession.metadata = metadata;
    coverArtUrl(book).then(
      (src) => {
        if (live && src) metadata.artwork = [{ src, sizes: "512x512", type: "image/png" }];
      },
      // No artwork; the title, chapter and buttons still show.
      (err: unknown) => console.error("media session: couldn't draw the cover:", err),
    );
    return () => {
      live = false;
    };
  }, [book, chapterTitle]);

  const playing = Boolean(live?.playing);
  useEffect(() => {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  // Whole seconds: the system draws its own progress bar between updates.
  const second = Math.floor(position);
  useEffect(() => {
    try {
      navigator.mediaSession.setPositionState({ duration: total, position: Math.min(second, total), playbackRate: playbackSpeed });
    } catch {
      // Older browsers have no progress bar; the buttons still work.
    }
  }, [second, total, playbackSpeed]);

  return null;
}
