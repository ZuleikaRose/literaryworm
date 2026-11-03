import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayback } from "../lib/playback";
import type { PlayerControls } from "../lib/usePlayerControls";
import { parseVoiceCommand, type Recognizer, recognizerClass, VOICE_HINTS, voiceCommandLabel, type VoiceCommand, voiceLanguage } from "../lib/voiceCommands";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

// Asked once per visit: after the first yes, the button turns voice control on straight away.
let agreedThisVisit = false;

/**
 * Voice control in car mode's top bar: off until the listener turns it on (the first time, a
 * dialog says the browser's speech service hears the words: Google's in Chrome, Apple's in
 * Safari). Then the browser's own speech recognition listens for Play, Pause, Back, Forward, the
 * chapters and Exit car mode (lib/voiceCommands.ts) while car mode is open and the tab is showing,
 * and says what it did in a status line. LiteraryWorm records and keeps nothing. Car mode offers
 * it only where voiceControlOffered() says so (never to Kids profiles).
 */
export function VoiceControl({ book, controls }: { book: Book; controls: PlayerControls }) {
  const playback = usePlayback();
  const navigate = useNavigate();
  const t = useT();
  const [on, setOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");
  const recognizer = useRef<Recognizer | null>(null);
  const wanted = useRef(false);
  // The latest controls, so the recognizer's handlers never act on a stale place.
  const latest = useRef({ controls, playback });
  useEffect(() => {
    latest.current = { controls, playback };
  });

  const stop = useCallback(() => {
    wanted.current = false;
    recognizer.current?.abort();
    recognizer.current = null;
    setOn(false);
  }, []);

  const run = useCallback(
    (command: VoiceCommand) => {
      const { controls: c, playback: p } = latest.current;
      switch (command.kind) {
        case "play":
          p.play();
          break;
        case "pause":
          p.pause();
          break;
        case "back":
          if (command.seconds === null) c.skipBack();
          else p.seek(Math.max(0, c.position - command.seconds));
          break;
        case "forward":
          if (command.seconds === null) c.skipForward();
          else p.seek(Math.min(c.total, c.position + command.seconds));
          break;
        case "nextChapter":
          c.nextChapter?.();
          break;
        case "previousChapter":
          c.previousChapter?.();
          break;
        case "exit":
          stop();
          navigate(`/listen/${book.id}`, { replace: true });
          return;
      }
      setStatus(t("Heard: {command}.", { command: voiceCommandLabel(command, { back: c.player.skipBack, forward: c.player.skipForward }) }));
    },
    [book.id, navigate, stop, t],
  );

  const start = useCallback(() => {
    const Recognition = recognizerClass();
    if (!Recognition) return;
    const r = new Recognition();
    r.continuous = true;
    r.interimResults = false;
    r.lang = voiceLanguage(navigator.language);
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const command = parseVoiceCommand(result[0]?.transcript ?? "");
        if (command) run(command);
      }
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus(t("Allow the microphone in your browser's settings."));
        stop();
      } else if (event.error === "network") {
        setStatus(t("Voice control needs a connection."));
      }
    };
    // Browsers stop listening after a while: start again while it's still wanted and showing.
    r.onend = () => {
      if (!wanted.current || recognizer.current !== r || document.hidden) return;
      window.setTimeout(() => {
        if (!wanted.current || recognizer.current !== r) return;
        try {
          r.start();
        } catch {
          /* already listening */
        }
      }, 300);
    };
    recognizer.current = r;
    wanted.current = true;
    setOn(true);
    setStatus(t("Listening for commands."));
    try {
      r.start();
    } catch {
      setStatus(t("Voice control couldn't start. Try again."));
      stop();
    }
  }, [run, stop, t]);

  // Hidden tab: stop listening. Back again: listen again if it was on. Leaving car mode stops it.
  useEffect(() => {
    const onVisibility = () => {
      const r = recognizer.current;
      if (!r || !wanted.current) return;
      if (document.hidden) r.abort();
      else {
        try {
          r.start();
        } catch {
          /* already listening */
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wanted.current = false;
      recognizer.current?.abort();
      recognizer.current = null;
    };
  }, []);

  const toggle = () => {
    if (on) {
      stop();
      setStatus(t("Voice control is off."));
    } else if (agreedThisVisit) start();
    else setAsking(true);
  };

  return (
    <>
      <button type="button" className={`secondary-button car-voice-button${on ? " is-on" : ""}`} aria-pressed={on} onClick={toggle}>
        <Icon name="mic" size={18} /> {t("Voice control")}
      </button>
      <p className="car-voice-status" role="status">
        {status}
      </p>
      <Dialog open={asking} onClose={() => setAsking(false)} title={t("Turn on voice control?")} eyebrow={t("Car mode")}>
        {/* The commands are said in English (lib/voiceCommands.ts listens for English words), so they stay English here. */}
        <p>
          {t("Say {commands} or {last}, and car mode does it. You can add a length, such as {example}.", {
            commands: VOICE_HINTS.slice(0, -1).join(", "),
            last: VOICE_HINTS[VOICE_HINTS.length - 1],
            example: "“back 30 seconds”",
          })}
        </p>
        <p>
          {t("Your browser listens through the microphone and its own speech service turns what you say into words: Google's in Chrome and Edge, Apple's in Safari. LiteraryWorm only reads the words for a command and keeps nothing. It listens only while car mode is open and on screen.")}
        </p>
        <div className="goal-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              agreedThisVisit = true;
              setAsking(false);
              start();
            }}
          >
            <Icon name="mic" size={18} /> {t("Turn on")}
          </button>
          <button type="button" className="ghost-button" onClick={() => setAsking(false)}>
            {t("Not now")}
          </button>
        </div>
      </Dialog>
    </>
  );
}
