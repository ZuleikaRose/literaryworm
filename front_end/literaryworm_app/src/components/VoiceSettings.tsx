import { useEffect, useState } from "react";
import { accentOf, LIBRIVOX_VOICE, narrationValue, resolveNarration, SILENT_VOICE, useVoices, voiceLabel } from "../lib/narration";
import { NATURAL_PREFIX, type NaturalVoice, voiceGender, voicesFor } from "../lib/naturalVoice";
import { deviceVoiceGender } from "../lib/deviceVoiceGender";
import { useNaturalVoice } from "../lib/useNaturalVoice";
import { useOnDeviceVoice } from "../lib/useOnDeviceVoice";
import { ON_DEVICE_ACCENTS, ON_DEVICE_PREFIX, type OnDeviceAccent, type OnDeviceVoice } from "../lib/onDeviceVoice";
import { forgetOnDeviceVoices, onDeviceVoiceKept, onDeviceVoicesKept } from "../lib/onDeviceCache";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useT } from "../lib/useT";
import { dateLocale } from "../lib/i18n";
import { useProfileData, useStore } from "../store/context";
import type { Book } from "../types";
import { CastChoices } from "./CastChoices";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { Pronunciations } from "./Pronunciations";
import { VoicePreviewButton } from "./VoicePreviewButton";

/**
 * Who reads a book and how, in one place: the Voice menu (natural voices first where they're
 * offered, with a preview; the natural voices that run on this device, for members' English books;
 * the LibriVox recording; the device's voices), Character voices, Who
 * reads whom and Pronunciations. The player and the mini-player's settings, the reader's *Voices*
 * button and a club's page all show it, so the voices can change at any time while reading or
 * listening; a change while the book plays carries on from the same place.
 */
export function VoiceSelect({ book }: { book: Book }) {
  const t = useT();
  const { dispatch } = useStore();
  const { narrationVoice } = useProfileData();
  const voices = useVoices();
  const naturalOffered = useNaturalVoice(book) !== null;
  const onDeviceVoices = useOnDeviceVoice(book);
  const narration = resolveNarration(book, narrationVoice, voices, naturalOffered, onDeviceVoices);
  // An English voice by its accent; another language's by the language's name, in the reader's language.
  const voiceKind = (v: NaturalVoice) =>
    v.accent === "British"
      ? t("British English")
      : v.accent === "American"
        ? t("American English")
        : v.accent === "Australian"
          ? t("Australian English")
          : (new Intl.DisplayNames([dateLocale()], { type: "language" }).of(v.language) ?? v.language);
  const accentName = (accent: "British" | "American" | "Australian") =>
    accent === "British" ? t("British English") : accent === "American" ? t("American English") : t("Australian English");
  // Device voices by accent, then women's, men's and voices whose name doesn't say (lib/deviceVoiceGender.ts).
  const deviceGroups = (["British", "American", "Australian"] as const).flatMap((accent) => {
    const inAccent = voices.filter((v) => accentOf(v) === accent);
    return [
      { key: `${accent}-woman`, label: t("{accent}: women's voices", { accent: accentName(accent) }), list: inAccent.filter((v) => deviceVoiceGender(v) === "woman") },
      { key: `${accent}-man`, label: t("{accent}: men's voices", { accent: accentName(accent) }), list: inAccent.filter((v) => deviceVoiceGender(v) === "man") },
      { key: `${accent}-other`, label: t("{accent}: other voices", { accent: accentName(accent) }), list: inAccent.filter((v) => deviceVoiceGender(v) === null) },
    ].filter((g) => g.list.length > 0);
  });
  // On-device voices: women's, men's and non-binary, each by accent (ON_DEVICE_ACCENTS), then name.
  const onDeviceAccent = (accent: OnDeviceAccent) =>
    ({
      American: t("American English"),
      British: t("British English"),
      Scottish: t("Scottish English"),
      Irish: t("Irish English"),
      Canadian: t("Canadian English"),
      Australian: t("Australian English"),
      "New Zealand": t("New Zealand English"),
      "South African": t("South African English"),
    })[accent];
  const byAccent = (a: OnDeviceVoice, b: OnDeviceVoice) =>
    ON_DEVICE_ACCENTS.indexOf(a.accent) - ON_DEVICE_ACCENTS.indexOf(b.accent) || a.name.localeCompare(b.name);
  const onDeviceGroups = [
    { gender: "woman", label: t("Natural voices on this device: women's (free, works offline)") },
    { gender: "man", label: t("Natural voices on this device: men's (free, works offline)") },
    { gender: "non-binary", label: t("Natural voices on this device: non-binary (free, works offline)") },
  ].map((g) => ({ ...g, list: onDeviceVoices.filter((v) => v.gender === g.gender).sort(byAccent) }))
    .filter((g) => g.list.length > 0);
  // Natural voices, women's then men's, each in the book's language first (voicesFor()).
  const naturalGroups = (["woman", "man"] as const).map((gender) => ({
    gender,
    label: gender === "woman" ? t("Natural voices (Google): women's") : t("Natural voices (Google): men's"),
    list: voicesFor(book.language).filter((v) => voiceGender(v.name) === gender),
  }));
  return (
    <>
      <label className="player-select player-voice">
        <span>{t("Voice")}</span>
        <select value={narrationValue(narration)} onChange={(e) => dispatch({ type: "setNarrationVoice", voice: e.target.value })}>
          {/* Natural voices first where they're offered (members' uploads and the classics). */}
          {naturalOffered &&
            naturalGroups.map((g) => (
              <optgroup key={g.gender} label={g.label}>
                {g.list.map((v) => (
                  <option key={v.id} value={NATURAL_PREFIX + v.id}>
                    {t("{name}, {accent}", { name: v.name, accent: voiceKind(v) })}
                  </option>
                ))}
              </optgroup>
            ))}
          {/* Natural voices that run in this browser (lib/onDeviceVoice.ts): free, offline, nothing sent. */}
          {onDeviceVoices.length > 0 &&
            onDeviceGroups.map((g) => (
              <optgroup key={g.gender} label={g.label}>
                {g.list.map((v) => (
                  <option key={v.id} value={ON_DEVICE_PREFIX + v.id}>
                    {t("{name}, {accent}", { name: v.name, accent: onDeviceAccent(v.accent) })}
                  </option>
                ))}
              </optgroup>
            ))}
          {book.recording && <option value={LIBRIVOX_VOICE}>{t("Original narrator: {name}", { name: book.recording.narrator })}</option>}
          {deviceGroups.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.list.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {voiceLabel(v)}
                </option>
              ))}
            </optgroup>
          ))}
          {!book.recording && <option value={SILENT_VOICE}>{book.upload ? t("No voice") : t("No voice (silent sample)")}</option>}
        </select>
      </label>
      {/* A few seconds of the chosen natural voice, recorded ahead (lib/voicePreview.ts). */}
      {narration.kind === "natural" && <VoicePreviewButton voiceId={narration.voice.id} name={narration.voice.name} />}
      {narration.kind === "onDevice" && <OnDeviceVoiceNote voice={narration.voice} />}
    </>
  );
}

/** Under the Voice menu while an on-device voice reads: what it downloads, and removing it from the device. */
function OnDeviceVoiceNote({ voice }: { voice: OnDeviceVoice }) {
  const t = useT();
  const [kept, setKept] = useState(0);
  const [thisOne, setThisOne] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => {
      void onDeviceVoicesKept().then((n) => live && setKept(n));
      void onDeviceVoiceKept(voice).then((k) => live && setThisOne(k));
    };
    check();
    // The model is saved once the first part plays; look again now and then while this is open.
    const timer = window.setInterval(check, 5000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [voice]);
  return (
    <div className="field-hint on-device-note">
      <p>
        {thisOne
          ? t("This voice runs on your device and works offline. What you read never leaves it.")
          : t("The first time, this voice downloads to your device (about {size} MB), then works offline. What you read never leaves your device.", { size: Math.round(voice.bytes / 1e6) })}
      </p>
      {kept > 0 && (
        <button
          type="button"
          className="text-button"
          onClick={() =>
            void forgetOnDeviceVoices().then(() => {
              setKept(0);
              setThisOne(false);
            })
          }
        >
          {t("Remove the on-device voices from this device")}
        </button>
      )}
    </div>
  );
}

/** Character voices, Who reads whom and Pronunciations, as items of a `.switch-list`. */
export function CharacterVoiceSettings({ book }: { book: Book }) {
  const t = useT();
  const { player, update } = usePlayerSettings(book.id);
  // Uploads and the classics have their own text to cut into speakers; other books have samples.
  const ownText = Boolean(book.upload || book.publicDomain);
  return (
    <>
      <li>
        <label className="switch-row">
          <span>
            <strong>{t("Character voices")}</strong>
            <small>{t("What the characters say is read by other voices: natural voices on your uploads and the classics, or your device's other voices when it reads a book aloud. Each named speaker keeps one voice.")}</small>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={player.characterVoices} onChange={(e) => update({ characterVoices: e.target.checked })} />
        </label>
      </li>
      {player.characterVoices && ownText && (
        <li>
          <CastChoices book={book} />
        </li>
      )}
      {/* Respellings for natural voices (it hides itself where they aren't offered). */}
      {ownText && (
        <li>
          <Pronunciations book={book} />
        </li>
      )}
    </>
  );
}

/** *Voices* (the reader's top bar, a club's page): the voice and the characters' voices for `book`, in a dialog. */
export function VoicesButton({ book, className = "icon-button", label = false }: { book: Book; className?: string; label?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="users" size={label ? 16 : 20} />
        {label ? ` ${t("Voices and characters")}` : <span className="visually-hidden">{t("Voices and characters")}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Voices and characters")} size="sm">
        <p className="field-hint">{t("Choose who reads {title} and give its characters voices of their own. Changes apply straight away, even while it plays.", { title: book.title })}</p>
        <div className="player-settings-form">
          <VoiceSelect book={book} />
        </div>
        <ul className="switch-list">
          <CharacterVoiceSettings book={book} />
        </ul>
      </Dialog>
    </>
  );
}
