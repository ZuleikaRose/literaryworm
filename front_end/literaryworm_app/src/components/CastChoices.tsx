import { useEffect, useId, useState } from "react";
import { CAST_SPEEDS, withCastSpeed } from "../lib/castSpeeds";
import { withCastChoice } from "../lib/castChoices";
import { bookText, resolveNarration, useVoices, voiceLabel } from "../lib/narration";
import { castVoiceFor } from "../lib/deviceCast";
import { withDeviceCastChoice } from "../lib/deviceCastChoices";
import { PREVIEW_TEXTS } from "../lib/voicePreview";
import { Icon } from "./Icon";
import { bookSpeakers, castNamesFor, defaultNaturalVoice, speakerVoice, voiceGender } from "../lib/naturalVoice";
import { deviceVoiceGender } from "../lib/deviceVoiceGender";
import { VoicePreviewButton } from "./VoicePreviewButton";
import { useProfileData } from "../store/context";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useT } from "../lib/useT";
import { useNaturalVoice } from "../lib/useNaturalVoice";
import type { Book } from "../types";

/**
 * *Who reads whom* (Player settings, with Character voices on): the book's named speakers, most
 * speeches first, each with a voice to choose or *Chosen for you*, and a speed of their own. With a
 * natural voice (members' uploads and classics) the voices are Google's; with a device voice (a classic's own text, or an
 * upload) they're the device's (lib/deviceCastChoices.ts); a LibriVox recording is one reader.
 */
export function CastChoices({ book }: { book: Book }) {
  const t = useT();
  const deviceVoices = useVoices();
  const natural = useNaturalVoice(book) !== null;
  const narration = resolveNarration(book, useProfileData().narrationVoice, deviceVoices, natural);
  if (narration.kind === "speech") return <DeviceCastChoices book={book} narrator={narration.voice} />;
  if (narration.kind !== "natural") {
    return (
      <section className="cast-choices">
        <h3>{t("Who reads whom")}</h3>
        <p className="field-hint">
          {natural
            ? t("The LibriVox recording is read by one person. Choose a natural voice or one of your device's voices under Voice to hear the characters in voices of their own.")
            : t("The LibriVox recording is read by one person. Choose one of your device's voices under Voice to hear the characters in voices of their own.")}
        </p>
      </section>
    );
  }
  return <NaturalCastChoices book={book} />;
}

function NaturalCastChoices({ book }: { book: Book }) {
  const t = useT();
  const id = useId();
  const { player, update } = usePlayerSettings(book.id);
  // The voices on offer are the narrator's language's own.
  const narration = resolveNarration(book, useProfileData().narrationVoice, [], true);
  const narrator = narration.kind === "natural" ? narration.voice : defaultNaturalVoice(book.language);
  const names = castNamesFor(narrator.languageCode);
  const [speakers, setSpeakers] = useState<{ speaker: string; speeches: number }[] | null>(null);

  useEffect(() => {
    let live = true;
    bookText(book).then(
      (chapters) => live && setSpeakers(bookSpeakers(chapters)),
      () => live && setSpeakers([]),
    );
    return () => {
      live = false;
    };
  }, [book]);

  const chosen = player.castChoices?.[book.id] ?? {};
  // A speed of their own for each speaker (lib/castSpeeds.ts), times the player's.
  const speeds = player.castSpeeds?.[book.id] ?? {};
  return (
    <section className="cast-choices" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("Who reads whom")}</h3>
      {speakers === null ? (
        <p className="field-hint" role="status">
          {t("Finding the speakers…")}
        </p>
      ) : speakers.length === 0 ? (
        <p className="field-hint">{t("No named speakers found in this book. What the characters say is still read in another voice.")}</p>
      ) : (
        <ul className="cast-choices-list">
          {speakers.map(({ speaker }) => (
            <li key={speaker}>
              <label className="player-select">
                <span>{speaker}</span>
                <select
                  value={chosen[speaker.toLowerCase()] ?? ""}
                  onChange={(e) => update({ castChoices: withCastChoice(player.castChoices, book.id, speaker, e.target.value || null) })}
                >
                  <option value="">{t("Chosen for you")}</option>
                  {/* Each voice says whose it is, so a man or a woman can be given a man's or a woman's voice. */}
                  {names.map((name) => (
                    <option key={name} value={name}>
                      {voiceGender(name) === "man" ? t("{name}, a man's voice", { name }) : t("{name}, a woman's voice", { name })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="player-select cast-speed">
                <span className="visually-hidden">{t("{name}'s speed", { name: speaker })}</span>
                <select
                  value={speeds[speaker.toLowerCase()] ?? ""}
                  onChange={(e) => update({ castSpeeds: withCastSpeed(player.castSpeeds, book.id, speaker, e.target.value ? Number(e.target.value) : null) })}
                >
                  <option value="">{t("Usual speed")}</option>
                  {CAST_SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              <VoicePreviewButton voiceId={speakerVoice(narrator, speaker, chosen)} name={speaker} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const languageOf = (lang: string) => lang.toLowerCase().split(/[-_]/)[0];

/** The speakers of a book's text, most speeches first ([] when none; null while loading). */
function useSpeakers(book: Book): { speaker: string; speeches: number }[] | null {
  const [speakers, setSpeakers] = useState<{ speaker: string; speeches: number }[] | null>(null);
  useEffect(() => {
    let live = true;
    bookText(book).then(
      (chapters) => live && setSpeakers(bookSpeakers(chapters)),
      () => live && setSpeakers([]),
    );
    return () => {
      live = false;
    };
  }, [book]);
  return speakers;
}

/** Who reads whom with a device voice: the device's voices in the narrator's language, per speaker. */
function DeviceCastChoices({ book, narrator }: { book: Book; narrator: SpeechSynthesisVoice }) {
  const t = useT();
  const id = useId();
  const { player, update } = usePlayerSettings(book.id);
  const speakers = useSpeakers(book);
  const [all, setAll] = useState<SpeechSynthesisVoice[]>(() => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setAll(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  const voices = all.filter((v) => languageOf(v.lang) === languageOf(narrator.lang)).sort((a, b) => voiceLabel(a).localeCompare(voiceLabel(b)));
  const chosen = player.deviceCastChoices?.[book.id] ?? {};
  const speeds = player.castSpeeds?.[book.id] ?? {};
  const onlyOne = voices.filter((v) => v.voiceURI !== narrator.voiceURI).length === 0;

  return (
    <section className="cast-choices" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("Who reads whom")}</h3>
      {onlyOne && <p className="field-hint">{t("Your device has one voice in this language, so each character is read at a pitch of their own.")}</p>}
      {speakers === null ? (
        <p className="field-hint" role="status">
          {t("Finding the speakers…")}
        </p>
      ) : speakers.length === 0 ? (
        <p className="field-hint">{t("No named speakers found in this book. What the characters say is still read in another voice.")}</p>
      ) : (
        <ul className="cast-choices-list">
          {speakers.map(({ speaker }) => {
            const key = speaker.toLowerCase();
            const picked = castVoiceFor(voices, narrator, speaker, chosen);
            return (
              <li key={speaker}>
                <label className="player-select">
                  <span>{speaker}</span>
                  <select
                    value={voices.some((v) => v.name === chosen[key]) ? chosen[key] : ""}
                    disabled={onlyOne}
                    onChange={(e) => update({ deviceCastChoices: withDeviceCastChoice(player.deviceCastChoices, book.id, speaker, e.target.value || null) })}
                  >
                    <option value="">{t("Chosen for you")}</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.name}>
                        {deviceVoiceGender(v) === "man"
                          ? t("{name}, a man's voice", { name: voiceLabel(v) })
                          : deviceVoiceGender(v) === "woman"
                            ? t("{name}, a woman's voice", { name: voiceLabel(v) })
                            : voiceLabel(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="player-select cast-speed">
                  <span className="visually-hidden">{t("{name}'s speed", { name: speaker })}</span>
                  <select
                    value={speeds[key] ?? ""}
                    onChange={(e) => update({ castSpeeds: withCastSpeed(player.castSpeeds, book.id, speaker, e.target.value ? Number(e.target.value) : null) })}
                  >
                    <option value="">{t("Usual speed")}</option>
                    {CAST_SPEEDS.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}×
                      </option>
                    ))}
                  </select>
                </label>
                <DeviceVoiceSample
                  voice={all.find((v) => v.voiceURI === picked.voiceURI) ?? narrator}
                  pitch={picked.pitch}
                  rate={speeds[key] ?? 1}
                  name={speaker}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Says a short sample in a device voice, at the speaker's pitch and speed; nothing is recorded or sent. */
function DeviceVoiceSample({ voice, pitch, rate, name }: { voice: SpeechSynthesisVoice; pitch: number; rate: number; name: string }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const toggle = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (on) {
      setOn(false);
      return;
    }
    const sample = new SpeechSynthesisUtterance(PREVIEW_TEXTS[languageOf(voice.lang)] ?? PREVIEW_TEXTS.en);
    sample.voice = voice;
    sample.lang = voice.lang;
    sample.pitch = pitch;
    sample.rate = rate;
    sample.onend = () => setOn(false);
    sample.onerror = () => setOn(false);
    setOn(true);
    synth.speak(sample);
  };
  return (
    <button type="button" className="icon-button voice-preview" aria-pressed={on} onClick={toggle}>
      <Icon name={on ? "pause" : "play"} size={16} filled />
      <span className="visually-hidden">{on ? t("Stop the sample") : t("Hear {name}", { name })}</span>
    </button>
  );
}
