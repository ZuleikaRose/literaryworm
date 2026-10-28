import { type FormEvent, useId, useRef, useState } from "react";
import { askBook, QUESTION_MAX } from "../lib/askApi";
import { chapterLabel } from "../lib/reading";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

type Exchange = { question: string; answer: string | null; error: string | null };

/**
 * Ask the book (public-domain titles): questions about what's been read so far, answered by
 * Claude from the text up to the reader's chapter. Kept while the reader is open.
 */
export function AskDialog({ open, book, chapterIndex, onClose }: { open: boolean; book: Book; chapterIndex: number; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const latest = useRef(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const asked = question.trim();
    if (asked.length < 3) return setFieldError("Ask a question of at least a few words.");
    if (asked.length > QUESTION_MAX) return setFieldError(`Questions are up to ${QUESTION_MAX} characters.`);
    setFieldError(null);
    setBusy(true);
    const ticket = ++latest.current;
    setExchanges((list) => [{ question: asked, answer: null, error: null }, ...list]);
    setQuestion("");
    const settle = (patch: Partial<Exchange>) =>
      setExchanges((list) => list.map((x, i) => (i === 0 && ticket === latest.current ? { ...x, ...patch } : x)));
    try {
      settle({ answer: await askBook(book.id, chapterIndex, asked) });
    } catch (err) {
      settle({ error: err instanceof Error ? err.message : "We couldn't answer that just now. Try again later." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Written by AI"
      title="Ask the book"
      description={<p>Answers come from the text up to {chapterLabel(book, chapterIndex)}, so they won't spoil what's ahead.</p>}
    >
      <form className="ask-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={inputId}>
            Your question
          </label>
          <textarea
            id={inputId}
            className="field-input"
            rows={2}
            maxLength={QUESTION_MAX}
            placeholder="Who is Mr Collins? Why is Elizabeth angry?"
            value={question}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {fieldError && (
            <p className="field-error" id={errorId}>
              <Icon name="alert" size={15} /> {fieldError}
            </p>
          )}
        </div>
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>
      <ol className="ask-answers" aria-live="polite">
        {exchanges.map((x, i) => (
          <li key={exchanges.length - i}>
            <p className="ask-question">{x.question}</p>
            {x.answer !== null && x.answer.split(/\n\s*\n/).map((p, j) => <p key={j}>{p}</p>)}
            {x.answer === null && !x.error && (
              <p className="summary-hint" role="status">
                Reading the book for an answer…
              </p>
            )}
            {x.error && (
              <p className="summary-error" role="alert">
                <Icon name="alert" size={15} /> {x.error}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="source-credit">Answered by Claude, an AI, from the public-domain text. It can make mistakes.</p>
    </Dialog>
  );
}
