import { useEffect, useState } from "react";
import { type ChapterRecap, fetchRecap, RecapError } from "../lib/recapApi";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { tr } from "../lib/i18n";
import { useT } from "../lib/useT";

/**
 * "Previously…" in the player and the mini-player: a recap of a public-domain title up to the
 * chapter playing now (lib/recapApi.ts), labelled as written by AI. Nothing from the chapter
 * playing or later goes into it.
 */
export function RecapDialog({ open, book, chapterIndex, onClose }: { open: boolean; book: Book; chapterIndex: number; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Previously…")} eyebrow={book.title}>
      {open && <Recap key={chapterIndex} book={book} chapterIndex={chapterIndex} />}
    </Dialog>
  );
}

function Recap({ book, chapterIndex }: { book: Book; chapterIndex: number }) {
  const t = useT();
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
        if (live) setError(err instanceof RecapError ? err.message : tr("Something went wrong. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, chapterIndex, tries]);

  return (
    <div className="recap">
      <p className="goal-hint">
        <Icon name="ask" size={15} />{" "}
        {t("Written by AI from chapters 1 to {last} only, so nothing from chapter {next} on is given away.", { last: chapterIndex, next: chapterIndex + 1 })}
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
              {t("Try again")}
            </button>
          </div>
        </div>
      ) : recap ? (
        <>
          <h3 className="recap-heading">{t("The story so far")}</h3>
          {recap.soFar.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <h3 className="recap-heading">{t("Last time, in chapter {chapter}", { chapter: chapterIndex })}</h3>
          <p>{recap.lastChapter}</p>
        </>
      ) : (
        <p role="status">{t("Catching you up…")}</p>
      )}
    </div>
  );
}
