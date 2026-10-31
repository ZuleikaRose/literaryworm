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

/** My Library → Words: the words this profile kept from the dictionary, and Practise. */
export function WordsView() {
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
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <section className="words-view" aria-labelledby="words-title">
      <div className="section-head">
        <div>
          <h2 id="words-title">My words</h2>
          <p className="muted">
            {words.words.length === 0
              ? "Look a word up in the reader's dictionary, then choose Keep in My words."
              : `${wordsSummary(words.words)}. ${due.length ? `${due.length} to review today. ` : "Nothing to review today. "}Private to this profile.`}
          </p>
        </div>
        {words.words.length > 0 && (
          <div className="words-actions">
            {due.length > 0 && (
              <button type="button" className="primary-button" onClick={() => setPractising("review")}>
                <Icon name="clock" size={17} /> Review {due.length} {due.length === 1 ? "word" : "words"}
              </button>
            )}
            <button type="button" className={due.length > 0 ? "secondary-button" : "primary-button"} onClick={() => setPractising("all")}>
              <Icon name="star" size={17} /> Practise all
            </button>
          </div>
        )}
      </div>
      {words.words.length > 0 && (
        <p className="field-hint">
          Review asks each word again after 1, 3, 7, 14, 30 and 60 days while you know it, and tomorrow when you don't. Known after
          the last one, it's marked as known.
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
                {w.learned ? <span className="word-known">Known</span> : <span className="word-due">{dueLabel(w, day)}</span>}
              </div>
              {w.definition && <p className="word-definition">{w.definition}</p>}
              {w.context && <q className="word-context">{w.context}</q>}
              {title && w.bookId && (
                <p className="word-source">
                  From{" "}
                  <Link to={`/read/${w.bookId}`}>
                    {title}
                    {w.chapterIndex !== null ? `, chapter ${w.chapterIndex + 1}` : ""}
                  </Link>
                </p>
              )}
              <div className="highlight-item-actions">
                <button type="button" className="text-button" onClick={() => run(() => words.setLearned(w.word, !w.learned), w.learned ? "Marked as still learning." : "Marked as known.")}>
                  {w.learned ? "Still learning" : "I know this"}
                  <span className="visually-hidden">: {w.word}</span>
                </button>
                <button type="button" className="text-button danger-text" onClick={() => run(() => words.remove(w.word), `Removed ${w.word}.`)}>
                  Remove<span className="visually-hidden"> {w.word}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={practising !== null} onClose={() => setPractising(null)} title={practising === "review" ? "Review" : "Practise"} size="sm">
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
  const [deck] = useState(initial);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const [known, setKnown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const card = deck[at];

  if (!card) {
    return (
      <div className="practise-done" role="status">
        <p>
          That's all {deck.length} word{deck.length === 1 ? "" : "s"}: you knew {known}.
        </p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
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
      setError(err instanceof Error ? err.message : "We couldn't save that. Try again.");
    }
  }

  return (
    <div className="practise-card">
      <p className="muted">
        Word {at + 1} of {deck.length}
      </p>
      <p className="practise-word" lang="en">
        {card.word}
      </p>
      {card.context && <q className="word-context">{card.context}</q>}
      <div aria-live="polite">{shown && <p className="word-definition">{card.definition ?? "No meaning was kept for this word."}</p>}</div>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="modal-actions">
        {shown ? (
          <>
            <button type="button" className="secondary-button" onClick={() => answer(false)}>
              Not yet
            </button>
            <button type="button" className="primary-button" onClick={() => answer(true)}>
              I knew it
            </button>
          </>
        ) : (
          <button type="button" className="primary-button" onClick={() => setShown(true)}>
            Show the meaning
          </button>
        )}
      </div>
    </div>
  );
}
