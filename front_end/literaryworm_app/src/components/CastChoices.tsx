import { useEffect, useId, useState } from "react";
import { withCastChoice } from "../lib/castChoices";
import { bookText, resolveNarration } from "../lib/narration";
import { bookSpeakers, castNamesFor, defaultNaturalVoice, speakerVoice } from "../lib/naturalVoice";
import { VoicePreviewButton } from "./VoicePreviewButton";
import { useProfileData } from "../store/context";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useT } from "../lib/useT";
import type { Book } from "../types";

/**
 * *Who reads whom* (Player settings, with Character voices on, for an upload): the book's named
 * speakers, most speeches first, each with a voice to choose or *Chosen for you*.
 */
export function CastChoices({ book }: { book: Book }) {
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
                  {names.map((name) => (
                    <option key={name} value={name}>
                      {name}
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
