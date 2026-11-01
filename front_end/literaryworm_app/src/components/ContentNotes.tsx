import { useEffect, useId, useState } from "react";
import { type BookContentNotes, LEVEL_LABEL, notesLine, present, topicLabel } from "../lib/contentNotes";
import { getContentNotes } from "../lib/contentNotesApi";
import { Icon } from "./Icon";

type Load = { status: "idle" | "loading" } | { status: "ready"; notes: BookContentNotes } | { status: "error"; message: string };

/**
 * A catalog book's content notes, written by AI (lib/contentNotes.ts): nothing is asked for until
 * the reader opens them. `compact` is the one-line version under a Kids profile's book request.
 */
export function ContentNotes({ bookId, compact = false }: { bookId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    let live = true;
    getContentNotes(bookId).then(
      (notes) => live && setLoad({ status: "ready", notes }),
      (err: Error) => live && setLoad({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [open, bookId]);

  const body =
    load.status === "ready" ? (
      compact ? (
        <p>{notesLine(load.notes.notes)}</p>
      ) : (
        <>
          <p>{load.notes.overall}</p>
          {present(load.notes.notes).length === 0 ? (
            <p>Nothing to flag.</p>
          ) : (
            <dl className="content-notes-list">
              {present(load.notes.notes).map((n) => (
                <div key={n.topic}>
                  <dt>
                    {topicLabel(n.topic)}: <span className={`content-level level-${n.level}`}>{LEVEL_LABEL[n.level]}</span>
                  </dt>
                  {n.note && <dd>{n.note}</dd>}
                </div>
              ))}
            </dl>
          )}
          <p className="summary-hint">Written by AI from the book's details, so it can miss things. Check anything that matters to you.</p>
        </>
      )
    ) : load.status === "error" ? (
      <p className="form-alert" role="alert">
        <Icon name="alert" size={17} /> {load.message}
      </p>
    ) : (
      open && <p className="summary-hint">Writing the content notes…</p>
    );

  return (
    <div className={compact ? "content-notes compact" : "content-notes"}>
      <button
        type="button"
        className="text-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open && load.status === "idle") setLoad({ status: "loading" });
          setOpen((o) => !o);
        }}
      >
        Content notes{compact ? "" : " (written by AI)"}
        <Icon name="chevronDown" size={14} className={open ? "flip" : undefined} />
      </button>
      <div id={panelId} hidden={!open} aria-live="polite">
        {body}
      </div>
    </div>
  );
}
