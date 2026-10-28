import { useEffect, useState } from "react";
import { type BookSummaries, getSummaries } from "../lib/summaryApi";
import { Icon } from "./Icon";

type Length = "short" | "detailed";

type Load = { status: "idle" } | { status: "loading" } | { status: "ready"; summaries: BookSummaries } | { status: "error"; message: string };

/**
 * A book's AI-written summaries, short or detailed. Nothing is asked for until the reader picks
 * one: the first reader of a book waits while it's written, everyone after gets it at once.
 * In a dialog (`inDialog`), the dialog carries the heading and the short summary opens at once.
 */
export function BookSummary({ bookId, title, inDialog = false }: { bookId: string; title: string; inDialog?: boolean }) {
  // Opening the summary from a dialog is already the choice to read it: start with the short one.
  const [length, setLength] = useState<Length | null>(inDialog ? "short" : null);
  const [load, setLoad] = useState<Load>({ status: inDialog ? "loading" : "idle" });

  const show = (next: Length) => {
    setLength(next);
    if (load.status === "ready" || load.status === "loading") return;
    setLoad({ status: "loading" });
    getSummaries(bookId).then(
      (summaries) => setLoad({ status: "ready", summaries }),
      (err: Error) => setLoad({ status: "error", message: err.message }),
    );
  };

  const [opened] = useState(inDialog);
  useEffect(() => {
    if (!opened) return;
    let live = true;
    getSummaries(bookId).then(
      (summaries) => live && setLoad({ status: "ready", summaries }),
      (err: Error) => live && setLoad({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [opened, bookId]);

  return (
    <section className={inDialog ? "book-summary in-dialog" : "book-summary"} aria-labelledby={inDialog ? undefined : "summary-title"} aria-label={inDialog ? "Summary" : undefined}>
      {!inDialog && (
        <>
          <p className="eyebrow">Written by AI</p>
          <h2 id="summary-title">Summary</h2>
        </>
      )}
      <div className="taste-row" role="group" aria-label="Summary length">
        <button type="button" className="taste-button" aria-pressed={length === "short"} onClick={() => show("short")}>
          Short
        </button>
        <button type="button" className="taste-button" aria-pressed={length === "detailed"} onClick={() => show("detailed")}>
          Detailed<span className="summary-spoiler"> (spoilers)</span>
        </button>
      </div>

      <div className="summary-body" aria-live="polite">
        {load.status === "idle" && <p className="summary-hint">Pick a length to read a summary of {title}.</p>}
        {load.status === "loading" && (
          <p className="summary-hint" role="status">
            Writing the summary. The first time can take up to half a minute.
          </p>
        )}
        {load.status === "error" && (
          <p className="summary-error" role="alert">
            <Icon name="alert" size={15} /> {load.message}{" "}
            <button type="button" className="text-button" onClick={() => length && show(length)}>
              Try again
            </button>
          </p>
        )}
        {load.status === "ready" &&
          length &&
          (length === "short" ? load.summaries.short : load.summaries.detailed)
            .split(/\n\s*\n/)
            .map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </div>
      <p className="source-credit">Summaries are written by Claude, an AI, from the book's details, and can contain mistakes.</p>
    </section>
  );
}
