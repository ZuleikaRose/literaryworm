import { useState } from "react";
import { accentOf, LIBRIVOX_VOICE, narrationValue, resolveNarration, SILENT_VOICE, useVoices, voiceLabel } from "../lib/narration";
import { NATURAL_PREFIX, type NaturalVoice, voicesFor } from "../lib/naturalVoice";
import { useNaturalVoice } from "../lib/useNaturalVoice";
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
 * offered, with a preview; the LibriVox recording; the device's voices), Character voices, Who
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
  const narration = resolveNarration(book, narrationVoice, voices, naturalOffered);
  // An English voice by its accent; another language's by the language's name, in the reader's language.
  const voiceKind = (v: NaturalVoice) =>
    v.accent === "British"
      ? t("British English")
      : v.accent === "American"
        ? t("American English")
        : v.accent === "Australian"
          ? t("Australian English")
          : (new Intl.DisplayNames([dateLocale()], { type: "language" }).of(v.language) ?? v.language);
  const accents = (["British", "American", "Australian"] as const)
    .map((accent) => [accent, voices.filter((v) => accentOf(v) === accent)] as const)
    .filter(([, list]) => list.length > 0);
  return (
    <>
      <label className="player-select player-voice">
        <span>{t("Voice")}</span>
        <select value={narrationValue(narration)} onChange={(e) => dispatch({ type: "setNarrationVoice", voice: e.target.value })}>
          {/* Natural voices first where they're offered (members' uploads and the classics). */}
          {naturalOffered && (
            <optgroup label={t("Natural voices (Google)")}>
              {voicesFor(book.language).map((v) => (
                <option key={v.id} value={NATURAL_PREFIX + v.id}>
                  {t("{name}, {accent}", { name: v.name, accent: voiceKind(v) })}
                </option>
              ))}
            </optgroup>
          )}
          {book.recording && <option value={LIBRIVOX_VOICE}>{t("Original narrator: {name}", { name: book.recording.narrator })}</option>}
          {accents.map(([accent, list]) => (
            <optgroup key={accent} label={accent === "British" ? t("British English") : accent === "American" ? t("American English") : t("Australian English")}>
              {list.map((v) => (
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
    </>
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
