import { useEffect, useRef, useState } from "react";
import { scoreLine, type QuizQuestion } from "../lib/quiz";
import { fetchQuiz, QuizError } from "../lib/quizApi";
import { useQuizResults } from "../lib/useQuizResults";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { tr } from "../lib/i18n";
import { useT } from "../lib/useT";

/**
 * Chapter quiz in the reader: a few questions about the chapter open now, one at a time, with
 * the answer explained after each. Written by AI from that chapter only, and labelled so.
 */
export function QuizDialog({ open, book, chapterIndex, onClose }: { open: boolean; book: Book; chapterIndex: number; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Chapter {n} quiz", { n: chapterIndex + 1 })} eyebrow={book.title} size="sm">
      {open && <Quiz key={chapterIndex} book={book} chapterIndex={chapterIndex} onClose={onClose} />}
    </Dialog>
  );
}

function Quiz({ book, chapterIndex, onClose }: { book: Book; chapterIndex: number; onClose: () => void }) {
  const t = useT();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const results = useQuizResults();
  // The score from before this try (kept when the quiz opens, so this try's own save doesn't replace it).
  const [before] = useState(() => results.find(book.id, chapterIndex));
  const headingRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let live = true;
    fetchQuiz(book.id, chapterIndex).then(
      (found) => {
        if (!live) return;
        setQuestions(found);
        setError(null);
      },
      (err) => {
        if (live) setError(err instanceof QuizError ? err.message : tr("Something went wrong. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, chapterIndex, tries]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [at]);

  const note = (
    <p className="goal-hint">
      <Icon name="ask" size={15} /> {t("Questions written by AI from chapter {n} only. Nothing about you is sent.", { n: chapterIndex + 1 })}
    </p>
  );

  if (error) {
    return (
      <div className="quiz">
        {note}
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{error}</p>
            <button type="button" className="secondary-button small-button" onClick={() => setTries((n) => n + 1)}>
              {t("Try again")}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!questions) {
    return (
      <div className="quiz">
        {note}
        <p role="status">{t("Getting the questions ready…")}</p>
      </div>
    );
  }

  const done = at >= questions.length;
  if (done) {
    return (
      <div className="quiz">
        <p className="quiz-score" role="status" tabIndex={-1} ref={headingRef}>
          {scoreLine(score, questions.length)}
        </p>
        {before && (
          <p className="muted">
            {t("Last time: {score} of {outOf}.", { score: before.score, outOf: before.outOf })}
          </p>
        )}
        {saveError && (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {saveError}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setAt(0);
              setScore(0);
              setPicked(null);
            }}
          >
            {t("Try again")}
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            {t("Back to the book")}
          </button>
        </div>
      </div>
    );
  }

  const q = questions[at];
  const answered = picked !== null;

  async function next() {
    const last = at === questions!.length - 1;
    const total = score;
    setPicked(null);
    setAt((i) => i + 1);
    if (last) {
      setSaveError(null);
      try {
        await results.record({ bookId: book.id, chapterIndex, score: total, outOf: questions!.length, takenAt: Date.now() });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : t("We couldn't save the score."));
      }
    }
  }

  return (
    <div className="quiz">
      {at === 0 && note}
      <p className="muted" tabIndex={-1} ref={headingRef}>
        {t("Question {n} of {total}", { n: at + 1, total: questions.length })}
      </p>
      <fieldset className="quiz-question">
        <legend>{q.question}</legend>
        <div className="quiz-choices">
          {q.choices.map((choice, i) => {
            const state = !answered ? "" : i === q.answer ? " is-right" : i === picked ? " is-wrong" : "";
            return (
              <button
                key={i}
                type="button"
                className={`quiz-choice${state}`}
                aria-pressed={picked === i}
                disabled={answered}
                onClick={() => {
                  setPicked(i);
                  if (i === q.answer) setScore((s) => s + 1);
                }}
              >
                {choice}
                {answered && i === q.answer && <span className="visually-hidden"> {t("(the right answer)")}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div aria-live="polite">
        {answered && (
          <p className={`quiz-feedback${picked === q.answer ? " is-right" : ""}`}>
            <Icon name={picked === q.answer ? "check" : "close"} size={16} /> {picked === q.answer ? t("That's right!") : t("Not quite: it's “{answer}”.", { answer: q.choices[q.answer] })}{" "}
            {q.explanation}
          </p>
        )}
      </div>
      {answered && (
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={next}>
            {at === questions.length - 1 ? t("See my score") : t("Next question")}
          </button>
        </div>
      )}
    </div>
  );
}
