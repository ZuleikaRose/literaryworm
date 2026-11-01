import { useEffect, useState } from "react";
import { type ChapterRecap, fetchRecap, RecapError } from "../lib/recapApi";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * "Previously…" in the player and the mini-player: a recap of a public-domain title up to the
 * chapter playing now (lib/recapApi.ts), labelled as written by AI. Nothing from the chapter
 * playing or later goes into it.
 */
export function RecapDialog({ open, book, chapterIndex, onClose }: { open: boolean; book: Book; chapterIndex: number; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Previously…" eyebrow={book.title}>
      {open && <Recap key={chapterIndex} book={book} chapterIndex={chapterIndex} />}
    </Dialog>
  );
}

function Recap({ book, chapterIndex }: { book: Book; chapterIndex: number }) {
  const [recap, setRecap] = useState<ChapterRecap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    fetchRecap(book.id, chapterIndex).then(
      (found) => {
        if (!live) return;
        setRecap(found);
        setError(null);
      },
      (err) => {
        if (live) setError(err instanceof RecapError ? err.message : "Something went wrong. Try again.");
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, chapterIndex, tries]);

  return (
    <div className="recap">
      <p className="goal-hint">
        <Icon name="ask" size={15} /> Written by AI from chapters 1 to {chapterIndex} only, so nothing from chapter {chapterIndex + 1} on is given away.
      </p>
      {error ? (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{error}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError(null);
                setTries((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : recap ? (
        <>
          <h3 className="recap-heading">The story so far</h3>
          {recap.soFar.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <h3 className="recap-heading">Last time, in chapter {chapterIndex}</h3>
          <p>{recap.lastChapter}</p>
        </>
      ) : (
        <p role="status">Catching you up…</p>
      )}
    </div>
  );
}
