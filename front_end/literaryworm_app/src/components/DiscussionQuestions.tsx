import { useId, useState } from "react";
import { discussableChapters } from "../lib/discussion";
import { fetchDiscussion } from "../lib/discussionApi";
import { chapterLabel } from "../lib/reading";
import { useT } from "../lib/useT";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * Discussion questions on a club's page: 5 to 8 questions about a chapter the reader has reached,
 * written by AI from the book up to the end of that chapter only (lib/discussionApi.ts), and
 * labelled so. Choosing one starts a post with it. Public-domain titles only (canDiscuss()).
 */
export function DiscussionQuestions({
  book,
  upTo,
  sample,
  onUse,
}: {
  book: Book;
  upTo: number;
  /** Questions already to hand by chapter (the demo club's), shown without asking the server. */
  sample?: Record<number, string[]>;
  onUse: (chapter: number, question: string) => void;
}) {
  const t = useT();
  const chapters = discussableChapters(upTo, book.chapters.length);
  const [chapter, setChapter] = useState(chapters[chapters.length - 1]);
  const [kept, setKept] = useState<Record<number, string[]>>(sample ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const questions = kept[chapter];

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await fetchDiscussion(book.id, chapter);
      setKept((k) => ({ ...k, [chapter]: list }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("We couldn't write questions just now. Try again later."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="discussion-questions"
      aria-labelledby={`${selectId}-title`}
    >
      <h3 id={`${selectId}-title`}>{t("Discussion questions")}</h3>
      <p className="goal-hint">
        <Icon name="ask" size={15} />{" "}
        {t("Written by AI from the book up to the end of the chapter you choose, so nothing later is given away. Only chapters you've reached are offered.")}
      </p>
      <div className="discussion-pick">
        <div className="field">
          <label className="field-label" htmlFor={selectId}>
            {t("Chapter")}
          </label>
          <select
            id={selectId}
            className="field-input"
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value))}
          >
            {chapters.map((i) => (
              <option key={i} value={i}>
                {chapterLabel(book, i)}
              </option>
            ))}
          </select>
        </div>
        {!questions && (
          <button
            type="button"
            className="secondary-button small-button"
            onClick={ask}
            disabled={busy}
            aria-describedby={error ? `${selectId}-error` : undefined}
          >
            <Icon name="ask" size={15} />{" "}
            {busy ? t("Writing questions…") : t("Get questions")}
          </button>
        )}
      </div>
      <div aria-live="polite">
        {error && (
          <p className="field-error" id={`${selectId}-error`} role="alert">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
        {questions && (
          <ol className="discussion-list">
            {questions.map((q) => (
              <li key={q}>
                <p>{q}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onUse(chapter, q)}
                >
                  {t("Start a post with this")}
                  <span className="visually-hidden">: {q}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
