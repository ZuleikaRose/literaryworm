import { type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cleanWord, type DictionaryEntry, DictionaryError, lookUpWord } from "../lib/dictionaryApi";
import { HIGHLIGHT_COLORS, highlightPlace, NOTE_MAX } from "../lib/highlights";
import { useWords } from "../lib/useWords";
import { firstDefinition, type WordSource } from "../lib/words";
import type { Book, Highlight, HighlightColor } from "../types";
import { Dialog } from "./Dialog";
import { ExportButtons } from "./NotesView";
import { Icon } from "./Icon";

/** Runs a save and keeps its error for the control that started it. */
function useAttempt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function attempt(work: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, attempt, setError };
}

const TOOLBAR_GAP = 10;

/**
 * The bar that floats over selected words: eight highlight colours, Add note and, for one word,
 * Define. It sits above the selection, or below it when there's no room, and stays on screen.
 */
export function SelectionToolbar({
  rect,
  canDefine,
  error,
  busy,
  onHighlight,
  onNote,
  onDefine,
  onDismiss,
}: {
  rect: DOMRect;
  canDefine: boolean;
  error: string | null;
  busy: boolean;
  onHighlight: (color: HighlightColor) => void;
  onNote: () => void;
  onDefine: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const { width, height } = bar.getBoundingClientRect();
    const margin = 8;
    const above = rect.top - height - TOOLBAR_GAP;
    const top = above >= margin ? above : Math.min(rect.bottom + TOOLBAR_GAP, window.innerHeight - height - margin);
    const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - margin);
    setPosition({ top, left });
  }, [rect, canDefine, error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      className="selection-toolbar"
      role="toolbar"
      aria-label="Selected text"
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      // Keep the selection: pressing a button mustn't move focus off the words first.
      onPointerDown={(e) => e.preventDefault()}
    >
      <div className="selection-swatches">
        {HIGHLIGHT_COLORS.map((c) => (
          <button key={c.value} type="button" className={`swatch swatch-${c.value}`} disabled={busy} onClick={() => onHighlight(c.value)}>
            <span className="visually-hidden">Highlight in {c.label.toLowerCase()}</span>
          </button>
        ))}
      </div>
      <div className="selection-row selection-actions">
        <button type="button" className="selection-action" disabled={busy} onClick={onNote}>
          <Icon name="edit" size={17} /> Add note
        </button>
        {canDefine && (
          <button type="button" className="selection-action" onClick={onDefine}>
            <Icon name="bookOpen" size={17} /> Define
          </button>
        )}
      </div>
      {error && (
        <p className="selection-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </div>
  );
}

/** One highlight: change its colour, write or edit its note, or remove it. */
export function HighlightDialog({
  highlight,
  focusNote,
  onClose,
  onUpdate,
  onRemove,
  onShare,
}: {
  highlight: Highlight | null;
  focusNote: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Highlight, "color" | "note">>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onShare: (h: Highlight) => void;
}) {
  return (
    <Dialog open={highlight !== null} onClose={onClose} eyebrow={highlight ? highlightPlace(highlight) : undefined} title="Highlight">
      {highlight && (
        <HighlightEditor
          key={highlight.id}
          highlight={highlight}
          focusNote={focusNote}
          onClose={onClose}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onShare={onShare}
        />
      )}
    </Dialog>
  );
}

function HighlightEditor({
  highlight,
  focusNote,
  onClose,
  onUpdate,
  onRemove,
  onShare,
}: {
  highlight: Highlight;
  focusNote: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Highlight, "color" | "note">>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onShare: (h: Highlight) => void;
}) {
  const [note, setNote] = useState(highlight.note ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const colour = useAttempt();
  const save = useAttempt();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const countId = useId();
  const errorId = useId();
  const tooLong = note.length > NOTE_MAX;
  const changed = (note.trim() || null) !== highlight.note;

  useEffect(() => {
    if (focusNote) noteRef.current?.focus();
  }, [focusNote]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (tooLong) return;
    setSaved(null);
    const ok = await save.attempt(() => onUpdate(highlight.id, { note }));
    if (ok) setSaved(note.trim() ? "Note saved." : "Note removed.");
  };

  return (
    <div className="highlight-editor">
      <blockquote className={`highlight-quote quote-${highlight.color}`}>{highlight.quote}</blockquote>

      <fieldset className="form-group">
        <legend className="field-label">Colour</legend>
        <div className="swatch-row">
          {HIGHLIGHT_COLORS.map((c) => (
            <label key={c.value} className={`swatch-option swatch-${c.value}`}>
              <input
                type="radio"
                name="highlight-colour"
                checked={highlight.color === c.value}
                disabled={colour.busy}
                onChange={() => colour.attempt(() => onUpdate(highlight.id, { color: c.value }))}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        {colour.error && (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {colour.error}
          </p>
        )}
      </fieldset>

      <form noValidate onSubmit={submit} className="note-form">
        <label className="field-label" htmlFor={noteId}>
          Note
        </label>
        <textarea
          ref={noteRef}
          id={noteId}
          className="field-input note-input"
          rows={4}
          value={note}
          placeholder="What does this passage make you think of?"
          aria-invalid={tooLong || Boolean(save.error) || undefined}
          aria-describedby={[countId, save.error || tooLong ? errorId : null].filter(Boolean).join(" ")}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(null);
          }}
        />
        <p className={`field-hint note-count${tooLong ? " over" : ""}`} id={countId}>
          {note.length} / {NOTE_MAX} characters. Private to your account.
        </p>
        {(save.error || tooLong) && (
          <p className="field-error" id={errorId} role="alert">
            <Icon name="alert" size={15} /> {tooLong ? `Keep the note to ${NOTE_MAX} characters.` : save.error}
          </p>
        )}
        {saved && (
          <p className="form-success" role="status">
            <Icon name="check" size={16} /> {saved}
          </p>
        )}
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={save.busy || !changed || tooLong}>
            {save.busy ? "Saving…" : highlight.note && !note.trim() ? "Remove note" : "Save note"}
          </button>
          <button
            type="button"
            className="ghost-button danger-text"
            disabled={save.busy}
            onClick={async () => {
              if (await save.attempt(() => onRemove(highlight.id))) onClose();
            }}
          >
            <Icon name="trash" size={16} /> Remove highlight
          </button>
          <button type="button" className="ghost-button" onClick={() => onShare(highlight)}>
            <Icon name="share" size={16} /> Share as a picture
          </button>
        </div>
      </form>
    </div>
  );
}

/** Every highlight in the book, by chapter. This is also how keyboard users reach them. */
export function HighlightsDialog({
  open,
  book,
  highlights,
  onClose,
  onGo,
  onEdit,
  onRemove,
  onShare,
}: {
  open: boolean;
  book: Book;
  highlights: Highlight[];
  onClose: () => void;
  onGo: (h: Highlight) => void;
  onEdit: (h: Highlight) => void;
  onRemove: (id: string) => Promise<void>;
  onShare: (h: Highlight) => void;
}) {
  const { busy, error, attempt } = useAttempt();
  const chapters = [...new Set(highlights.map((h) => h.chapterIndex))];
  const notes = highlights.filter((h) => h.note).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Notes and highlights"
      description={
        <p>
          {highlights.length === 0
            ? "Select words on a page to highlight them or add a note."
            : `${highlights.length} highlight${highlights.length === 1 ? "" : "s"}, ${notes} with a note. Private to your account.`}
        </p>
      }
    >
      {highlights.length > 0 && (
        <ExportButtons
          books={[{ title: book.title, author: book.author, chapterTitles: book.chapters.map((c) => c.title), highlights }]}
          name={book.title}
          label="Export these notes and highlights"
        />
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      {chapters.map((chapterIndex) => (
        <section key={chapterIndex} className="highlight-group" aria-labelledby={`hl-chapter-${chapterIndex}`}>
          <h3 id={`hl-chapter-${chapterIndex}`}>{book.chapters[chapterIndex]?.title ?? `Chapter ${chapterIndex + 1}`}</h3>
          <ul className="highlight-list">
            {highlights
              .filter((h) => h.chapterIndex === chapterIndex)
              .map((h) => (
                <li key={h.id} className={`highlight-item quote-${h.color}`}>
                  <p className="highlight-item-quote">{h.quote}</p>
                  {h.note && (
                    <p className="highlight-item-note">
                      <Icon name="edit" size={14} />
                      <span className="visually-hidden">Note: </span>
                      {h.note}
                    </p>
                  )}
                  <div className="highlight-item-actions">
                    <button type="button" className="text-button" onClick={() => onGo(h)}>
                      Go to page {h.page + 1}
                    </button>
                    <button type="button" className="text-button" onClick={() => onEdit(h)}>
                      {h.note ? "Edit" : "Add note"}
                      <span className="visually-hidden"> for the highlight on {highlightPlace(h).toLowerCase()}</span>
                    </button>
                    <button type="button" className="text-button" onClick={() => onShare(h)}>
                      Share<span className="visually-hidden"> the highlight on {highlightPlace(h).toLowerCase()} as a picture</span>
                    </button>
                    <button type="button" className="text-button danger-text" disabled={busy} onClick={() => attempt(() => onRemove(h.id))}>
                      Remove<span className="visually-hidden"> the highlight on {highlightPlace(h).toLowerCase()}</span>
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}

/** Looks a word up. Opened with a word from the page, or empty to type one. */
export function DictionaryDialog({
  open,
  word,
  source = null,
  onClose,
}: {
  open: boolean;
  word: string;
  /** Where the word was met, kept with it in My words. */
  source?: WordSource | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Dictionary" size="sm">
      {open && <DictionaryLookup key={word} initialWord={word} source={source} />}
    </Dialog>
  );
}

type Lookup = { status: "idle" } | { status: "loading"; word: string } | { status: "done"; entry: DictionaryEntry } | { status: "error"; message: string };

function DictionaryLookup({ initialWord, source }: { initialWord: string; source: WordSource | null }) {
  const [query, setQuery] = useState(initialWord);
  const [result, setResult] = useState<Lookup>({ status: "idle" });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const latest = useRef(0);

  const run = (input: string) => {
    const word = cleanWord(input);
    if (!word) {
      setFieldError("Look up one English word, using letters only.");
      return;
    }
    setFieldError(null);
    const ticket = ++latest.current;
    setResult({ status: "loading", word });
    lookUpWord(word).then(
      (entry) => ticket === latest.current && setResult({ status: "done", entry }),
      (err) =>
        ticket === latest.current &&
        setResult({ status: "error", message: err instanceof DictionaryError ? err.message : "The dictionary isn't answering right now. Try again." }),
    );
  };

  // A word chosen on the page is looked up straight away.
  const first = useRef(initialWord);
  useEffect(() => {
    if (first.current) run(first.current);
  }, []);

  return (
    <div className="dictionary">
      <form
        noValidate
        role="search"
        className="dictionary-search"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <label className="visually-hidden" htmlFor={inputId}>
          Word to look up
        </label>
        <input
          id={inputId}
          className="field-input"
          type="search"
          value={query}
          placeholder="Look up a word"
          autoComplete="off"
          spellCheck
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errorId : undefined}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="secondary-button">
          Look up
        </button>
      </form>
      {fieldError && (
        <p className="field-error" id={errorId}>
          <Icon name="alert" size={15} /> {fieldError}
        </p>
      )}

      <div className="dictionary-result" aria-live="polite" aria-busy={result.status === "loading"}>
        {result.status === "loading" && <p className="muted">Looking up “{result.word}”…</p>}
        {result.status === "error" && (
          <p className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <span>{result.message}</span>
          </p>
        )}
        {result.status === "done" && (
          <>
            <DictionaryEntryView entry={result.entry} />
            {/* A word typed in isn't from the page, so it keeps only the book. */}
            <KeepWord entry={result.entry} source={source && result.entry.word === cleanWord(initialWord) ? source : source && { ...source, context: null }} />
          </>
        )}
      </div>
    </div>
  );
}

/** Keep in My words: the word, its first sense and the sentence it came from. */
function KeepWord({ entry, source }: { entry: DictionaryEntry; source: WordSource | null }) {
  const words = useWords();
  const { busy, error, attempt } = useAttempt();
  const kept = words.has(entry.word);
  return (
    <div className="keep-word">
      {kept ? (
        <p className="keep-word-done" role="status">
          <Icon name="check" size={16} /> In My words. Find it in My Library → Words.
        </p>
      ) : (
        <button type="button" className="secondary-button" disabled={busy} onClick={() => attempt(() => words.save(entry.word, firstDefinition(entry), source))}>
          <Icon name="plus" size={16} /> Keep in My words
        </button>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </div>
  );
}

function DictionaryEntryView({ entry }: { entry: DictionaryEntry }) {
  return (
    <article className="dictionary-entry" lang="en">
      <h3>
        {entry.word}
        {entry.phonetic && <span className="dictionary-phonetic">{entry.phonetic}</span>}
      </h3>
      {entry.meanings.map((m) => (
        <section key={m.partOfSpeech}>
          <h4>{m.partOfSpeech}</h4>
          <ol>
            {m.definitions.map((d, i) => (
              <li key={i}>
                {d.definition}
                {d.example && <q className="dictionary-example">{d.example}</q>}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="dictionary-credit">
        Definitions from{" "}
        {entry.sourceUrl ? (
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
            Wiktionary<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : (
          "Wiktionary"
        )}
        , CC BY-SA.
      </p>
    </article>
  );
}
