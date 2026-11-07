import { type FormEvent, useId, useState } from "react";
import { PRONOUNCE_SAY_MAX, PRONOUNCE_WORD_MAX } from "../lib/naturalVoice";
import { pronunciationError, withPronunciation } from "../lib/pronunciations";
import { useNaturalVoice } from "../lib/useNaturalVoice";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useT } from "../lib/useT";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * *Pronunciations* (Player settings, for an upload a natural voice reads): names the voice says
 * wrongly, each respelled the way it sounds. Kept per book with the player settings; only the parts
 * that have one of the words are voiced again.
 */
export function Pronunciations({ book }: { book: Book }) {
  const t = useT();
  const id = useId();
  const source = useNaturalVoice(book);
  const { player, update } = usePlayerSettings(book.id);
  const [word, setWord] = useState("");
  const [say, setSay] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (source === null) return null;

  const mine = player.pronunciations?.[book.id] ?? {};
  const words = Object.keys(mine).sort((a, b) => a.localeCompare(b));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const problem = pronunciationError(word, say, mine);
    if (problem) {
      setError(problem);
      return;
    }
    update({ pronunciations: withPronunciation(player.pronunciations, book.id, word, say) });
    setWord("");
    setSay("");
    setError(null);
  };

  return (
    <section className="pronunciations" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t("Pronunciations")}</h3>
      <p className="field-hint">
        {source === "demo"
          ? t("Spell a name the way it sounds, like her-MY-oh-nee for Hermione. Members hear the change; the demo's recordings stay as they are.")
          : t("Spell a name the way it sounds, like her-MY-oh-nee for Hermione. Only the parts with that name are read again.")}
      </p>
      {words.length > 0 && (
        <ul className="pronunciations-list">
          {words.map((w) => (
            <li key={w}>
              <span>
                <strong>{w}</strong> {t("sounds like")} <em>{mine[w]}</em>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={t("Remove the pronunciation of {word}", { word: w })}
                onClick={() => update({ pronunciations: withPronunciation(player.pronunciations, book.id, w, null) })}
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="pronunciations-form" onSubmit={add} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-word`}>
            {t("Name or word")}
          </label>
          <input
            id={`${id}-word`}
            className="field-input"
            value={word}
            maxLength={PRONOUNCE_WORD_MAX}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setWord(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-say`}>
            {t("Sounds like")}
          </label>
          <input
            id={`${id}-say`}
            className="field-input"
            value={say}
            maxLength={PRONOUNCE_SAY_MAX}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setSay(e.target.value)}
          />
        </div>
        <button type="submit" className="secondary-button small-button">
          {t("Add")}
        </button>
        {error && (
          <p className="field-error" id={`${id}-error`} role="alert">
            <Icon name="alert" size={15} />
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
