import { useState } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { useWords } from "../lib/useWords";
import { practiceDeck, wordsSummary } from "../lib/words";
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
  const [practising, setPractising] = useState(false);
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
              : `${wordsSummary(words.words)}. Private to this profile.`}
          </p>
        </div>
        {words.words.length > 0 && (
          <button type="button" className="primary-button" onClick={() => setPractising(true)}>
            <Icon name="star" size={17} /> Practise
          </button>
        )}
      </div>
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
                {w.learned && <span className="word-known">Known</span>}
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
      <PractiseDialog open={practising} words={words.words} onClose={() => setPractising(false)} onKnown={(w, known) => words.setLearned(w, known)} />
    </section>
  );
}

/** Flashcards: the word first, then its meaning on request; I knew it or Not yet. */
function PractiseDialog({
  open,
  words,
  onClose,
  onKnown,
}: {
  open: boolean;
  words: SavedWord[];
  onClose: () => void;
  onKnown: (word: string, known: boolean) => Promise<void>;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Practise" size="sm">
      {open && <Cards deck={practiceDeck(words)} onClose={onClose} onKnown={onKnown} />}
    </Dialog>
  );
}

function Cards({ deck, onClose, onKnown }: { deck: SavedWord[]; onClose: () => void; onKnown: (word: string, known: boolean) => Promise<void> }) {
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
      if (knew !== card.learned) await onKnown(card.word, knew);
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
