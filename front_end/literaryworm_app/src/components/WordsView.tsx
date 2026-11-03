import { useState } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { useWords } from "../lib/useWords";
import { today } from "../lib/reading";
import { dueLabel, dueWords, practiceDeck, wordsSummary } from "../lib/words";
import { activeLibrary } from "../store/reducer";
import { useStore } from "../store/context";
import type { SavedWord } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";

/** My Library → Words: the words this profile kept from the dictionary, and Practise. */
export function WordsView() {
  const t = useT();
  const words = useWords();
  const { state } = useStore();
  const library = activeLibrary(state);
  const [error, setError] = useState<string | null>(null);
  const [practising, setPractising] = useState<"review" | "all" | null>(null);
  const [day] = useState(() => today());
  const due = dueWords(words.words, day);
  const [announcement, setAnnouncement] = useState("");

  const bookTitle = (id: string | null) => (id ? (getBook(id)?.title ?? library[id]?.title ?? null) : null);

  async function run(work: () => Promise<void>, done: string) {
    setError(null);
    try {
      await work();
      setAnnouncement(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Try again."));
    }
  }

  return (
    <section className="words-view" aria-labelledby="words-title">
      <div className="section-head">
        <div>
          <h2 id="words-title">{t("My words")}</h2>
          <p className="muted">
            {words.words.length === 0
              ? t("Look a word up in the reader's dictionary, then choose Keep in My words.")
              : due.length
                ? t("{summary}. {n} to review today. Private to this profile.", { summary: wordsSummary(words.words, t), n: due.length })
                : t("{summary}. Nothing to review today. Private to this profile.", { summary: wordsSummary(words.words, t) })}
          </p>
        </div>
        {words.words.length > 0 && (
          <div className="words-actions">
            {due.length > 0 && (
              <button type="button" className="primary-button" onClick={() => setPractising("review")}>
                <Icon name="clock" size={17} /> {t.plural(due.length, { one: "Review {count} word", other: "Review {count} words" })}
              </button>
            )}
            <button type="button" className={due.length > 0 ? "secondary-button" : "primary-button"} onClick={() => setPractising("all")}>
              <Icon name="star" size={17} /> {t("Practise all")}
            </button>
          </div>
        )}
      </div>
      {words.words.length > 0 && (
        <p className="field-hint">
          {t("Review asks each word again after 1, 3, 7, 14, 30 and 60 days while you know it, and tomorrow when you don't. Known after the last one, it's marked as known.")}
        </p>
      )}
      {error && (
        <p className="form-alert" role="alert">
          <Icon name="alert" size={17} /> <span>{error}</span>
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <ul className="word-list" role="list">
        {words.words.map((w) => {
          const title = bookTitle(w.bookId);
          return (
            <li key={w.word} className="word-item">
              <div className="word-head">
                <h3 lang="en">{w.word}</h3>
                {w.learned ? <span className="word-known">{t("Known")}</span> : <span className="word-due">{dueLabel(w, day, t)}</span>}
              </div>
              {w.definition && <p className="word-definition">{w.definition}</p>}
              {w.context && <q className="word-context">{w.context}</q>}
              {title && w.bookId && (
                <p className="word-source">
                  {rich(t("From {place}"), {
                    place: (
                      <Link to={`/read/${w.bookId}`}>
                        {w.chapterIndex !== null ? t("{title}, chapter {n}", { title, n: w.chapterIndex + 1 }) : title}
                      </Link>
                    ),
                  })}
                </p>
              )}
              <div className="highlight-item-actions">
                <button type="button" className="text-button" onClick={() => run(() => words.setLearned(w.word, !w.learned), w.learned ? t("Marked as still learning.") : t("Marked as known."))}>
                  {w.learned ? t("Still learning") : t("I know this")}
                  <span className="visually-hidden">: {w.word}</span>
                </button>
                <button type="button" className="text-button danger-text" onClick={() => run(() => words.remove(w.word), t("Removed {word}.", { word: w.word }))}>
                  {t("Remove")}<span className="visually-hidden"> {w.word}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={practising !== null} onClose={() => setPractising(null)} title={practising === "review" ? t("Review") : t("Practise")} size="sm">
        {practising === "review" && <Cards deck={due} onClose={() => setPractising(null)} onAnswer={(w, knew) => words.review(w.word, knew)} />}
        {practising === "all" && (
          <Cards
            deck={practiceDeck(words.words)}
            onClose={() => setPractising(null)}
            onAnswer={async (w, knew) => {
              if (knew !== w.learned) await words.setLearned(w.word, knew);
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

/** Flashcards: the word first, then its meaning on request; I knew it or Not yet. */
function Cards({ deck: initial, onClose, onAnswer }: { deck: SavedWord[]; onClose: () => void; onAnswer: (word: SavedWord, knew: boolean) => Promise<void> }) {
  // The deck as it was when the dialog opened, so answers don't reshuffle it.
  const t = useT();
  const [deck] = useState(initial);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const [known, setKnown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const card = deck[at];

  if (!card) {
    return (
      <div className="practise-done" role="status">
        <p>{t.plural(deck.length, { one: "That's all {count} word: you knew {known}.", other: "That's all {count} words: you knew {known}." }, { known })}</p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            {t("Done")}
          </button>
        </div>
      </div>
    );
  }

  async function answer(knew: boolean) {
    setError(null);
    try {
      await onAnswer(card, knew);
      if (knew) setKnown((k) => k + 1);
      setShown(false);
      setAt((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save that. Try again."));
    }
  }

  return (
    <div className="practise-card">
      <p className="muted">
        {t("Word {n} of {total}", { n: at + 1, total: deck.length })}
      </p>
      <p className="practise-word" lang="en">
        {card.word}
      </p>
      {card.context && <q className="word-context">{card.context}</q>}
      <div aria-live="polite">{shown && <p className="word-definition">{card.definition ?? t("No meaning was kept for this word.")}</p>}</div>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="modal-actions">
        {shown ? (
          <>
            <button type="button" className="secondary-button" onClick={() => answer(false)}>
              {t("Not yet")}
            </button>
            <button type="button" className="primary-button" onClick={() => answer(true)}>
              {t("I knew it")}
            </button>
          </>
        ) : (
          <button type="button" className="primary-button" onClick={() => setShown(true)}>
            {t("Show the meaning")}
          </button>
        )}
      </div>
    </div>
  );
}
