import { useEffect, useState } from "react";
import { previewPath } from "../lib/voicePreview";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

// One preview at a time, across every button.
let playing: HTMLAudioElement | null = null;
let stopOthers: (() => void) | null = null;

/**
 * Plays a natural voice's preview (lib/voicePreview.ts): a few seconds recorded once and served
 * with the site, so nothing is voiced or sent anywhere. Pressing it again stops it.
 */
export function VoicePreviewButton({ voiceId, name }: { voiceId: string; name: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  useEffect(
    () => () => {
      if (playing && on) playing.pause();
    },
    [on],
  );

  const toggle = () => {
    if (on) {
      playing?.pause();
      setOn(false);
      return;
    }
    stopOthers?.();
    const audio = new Audio(`/${previewPath(voiceId)}`);
    playing = audio;
    stopOthers = () => {
      audio.pause();
      setOn(false);
    };
    audio.onended = () => setOn(false);
    audio.onerror = () => setOn(false);
    setOn(true);
    audio.play().catch(() => setOn(false));
  };

  return (
    <button type="button" className="icon-button voice-preview" aria-pressed={on} onClick={toggle}>
      <Icon name={on ? "pause" : "play"} size={16} filled />
      <span className="visually-hidden">{on ? t("Stop the sample") : t("Hear {name}", { name })}</span>
    </button>
  );
}
