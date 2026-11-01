import { useEffect, useId, useState } from "react";
import { defaultTarget, passageFor, TRANSLATE_LANGUAGES, type TranslateLanguage, translatePassage } from "../lib/translateApi";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

// The last language chosen, while the app is open (in memory, like the reader's other choices).
let lastTarget: TranslateLanguage | null = null;

/**
 * Translate (public-domain titles, not Kids profiles): the words a reader selected, translated by
 * Claude. Choose the language; only the passage is sent.
 */
export function TranslateDialog({ book, chapterIndex, text, onClose }: { book: Book; chapterIndex: number; text: string | null; onClose: () => void }) {
  const [to, setTo] = useState<TranslateLanguage>(() => defaultTarget(book.language, lastTarget));
  const [result, setResult] = useState<{ key: string; translation: string | null; error: string | null } | null>(null);
  const selectId = useId();
  const passage = text ? passageFor(text) : "";
  const key = `${chapterIndex}:${to}:${passage}`;

  useEffect(() => {
    if (!passage) return;
    let live = true;
    translatePassage(book.id, chapterIndex, passage, to).then(
      (translation) => live && setResult({ key, translation, error: null }),
      (err: unknown) => live && setResult({ key, translation: null, error: err instanceof Error ? err.message : "We couldn't translate that just now. Try again later." }),
    );
    return () => {
      live = false;
    };
  }, [book.id, chapterIndex, passage, to, key]);

  const current = result?.key === key ? result : null;
  return (
    <Dialog open={text !== null} onClose={onClose} eyebrow="Written by AI" title="Translate" description={<p>Only the words you selected are sent to be translated.</p>}>
      <div className="field">
        <label className="field-label" htmlFor={selectId}>
          Translate into
        </label>
        <select
          id={selectId}
          className="field-input"
          value={to}
          onChange={(e) => {
            const next = e.target.value as TranslateLanguage;
            lastTarget = next;
            setTo(next);
          }}
        >
          {TRANSLATE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <blockquote className="translate-original" lang={book.language === "French" ? "fr" : book.language === "German" ? "de" : book.language === "Spanish" ? "es" : "en"}>
        {passage}
      </blockquote>
      <div className="translate-result" aria-live="polite" aria-busy={!current}>
        {!current ? (
          <p className="goal-hint">Translating…</p>
        ) : current.error ? (
          <p className="form-alert" role="alert">
            <Icon name="alert" size={17} /> {current.error}
          </p>
        ) : (
          <p lang={to}>{current.translation}</p>
        )}
      </div>
    </Dialog>
  );
}
