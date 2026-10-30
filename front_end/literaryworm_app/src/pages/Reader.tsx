import { type CSSProperties, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  BookmarksDialog,
  ChaptersDialog,
  DailyLimitReached,
  FinishedPanel,
  MarkFinishedDialog,
  ReadingGate,
  ReadingMessage,
} from "../components/ReadingParts";
import { AskDialog } from "../components/AskDialog";
import { CharactersDialog } from "../components/CharactersDialog";
import { ReaderDisplayDialog } from "../components/ReaderDisplayDialog";
import { QuoteCardDialog } from "../components/QuoteCardDialog";
import { DictionaryDialog, HighlightDialog, HighlightsDialog, SelectionToolbar } from "../components/StudyTools";
import { samplePage } from "../data/sampleText";
import { type PageSelection, paragraphOffsets, paragraphSegments, selectionOnPage, singleWord } from "../lib/highlights";
import { usePlayback } from "../lib/playback";
import { chapterStarts, pageForFraction, pageFraction, READER_SIZES, type ReaderPage } from "../lib/reading";
import { useBookPages } from "../lib/useBookPages";
import { useControlsVisibility } from "../lib/useControlsVisibility";
import { useDailyLimit } from "../lib/useDailyLimit";
import { useHighlights } from "../lib/useHighlights";
import { useReading } from "../lib/useReading";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useProfileData } from "../store/context";
import type { Book, Highlight, HighlightColor } from "../types";

type Panel = "chapters" | "bookmarks" | "display" | "highlights" | "dictionary" | "ask" | "characters" | null;

export default function Reader() {
  return <ReadingGate format="ebook">{(book) => <ReaderPages key={book.id} book={book} />}</ReadingGate>;
}

/** Loads the book's pages (real text for public-domain titles), then opens the reader. */
function ReaderPages({ book }: { book: Book }) {
  const { pages, error, retry } = useBookPages(book);
  if (error) {
    return (
      <ReadingMessage
        title={`We couldn't open ${book.title}`}
        icon="bookOpen"
        action={
          <button type="button" className="primary-button" onClick={retry}>
            Try again
          </button>
        }
      >
        <p>{error}</p>
      </ReadingMessage>
    );
  }
  if (!pages) {
    return (
      <ReadingMessage title={`Opening ${book.title}`} icon="bookOpen">
        <p role="status">Loading the book's text…</p>
      </ReadingMessage>
    );
  }
  return <ReaderView book={book} pages={pages} />;
}

const LINE_HEIGHTS = { compact: 1.45, normal: 1.65, relaxed: 1.9 };
const MEASURES = { narrow: "44rem", normal: "38rem", wide: "32rem" };

function ReaderView({ book, pages }: { book: Book; pages: ReaderPage[] }) {
  useTitle(`Reading ${book.title}`);
  const settings = useProfileData().readerSettings;
  const profile = useActiveProfile();
  const reading = useReading(book);
  const study = useHighlights(book, reading.addToLibrary);
  const limit = useDailyLimit(true);
  const playback = usePlayback();
  const starts = chapterStarts(pages);
  const total = pages.length;

  // Start where the account stopped (unless the book was finished: then from the start).
  const [index, setIndex] = useState(() =>
    reading.progress && !reading.progress.finished ? pageForFraction(reading.progress.fraction, total) : 0,
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [asking, setAsking] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selection, setSelection] = useState<(PageSelection & { rect: DOMRect }) | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; focusNote: boolean } | null>(null);
  const [sharing, setSharing] = useState<Highlight | null>(null);
  const [dictionaryWord, setDictionaryWord] = useState("");
  // The place this reader last opened at or saved. A different saved place means another device
  // moved on (useReadingSync reloads it when the tab comes back), and the reader offers to go there.
  const [ownFraction, setOwnFraction] = useState(() => reading.progress?.fraction ?? 0);
  const { visible, show } = useControlsVisibility(panel === null && !asking && !finished && !editing && !selection);
  const pageRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const pointerDown = useRef(false);

  // One book at a time: opening the reader pauses an audiobook playing in the mini-player.
  const pausePlayback = playback.pause;
  useEffect(() => {
    pausePlayback();
  }, [pausePlayback]);

  const page = pages[index];
  const chapter = book.chapters[page.chapterIndex];
  const pagesInChapter = pages.filter((p) => p.chapterIndex === page.chapterIndex).length;
  const hereLabel = `Chapter ${page.chapterIndex + 1}, page ${page.page + 1}`;
  const paragraphs = page.paragraphs ?? samplePage(book.id, page.chapterIndex, page.page);
  const offsets = paragraphOffsets(paragraphs);
  const pageText = paragraphs.join("\n");
  // Only highlights whose words are still there: ones made on the sample pages before a book had
  // its real text point at different words now, so they're listed but not drawn.
  const pageHighlights = study.highlights.filter(
    (h) => h.chapterIndex === page.chapterIndex && h.page === page.page && pageText.slice(h.start, h.end).replace(/\n/g, " ") === h.quote,
  );
  const editingHighlight = editing ? (study.highlights.find((h) => h.id === editing.id) ?? null) : null;

  // The selected words, as a range of this page's text, for the selection toolbar.
  const pageTextRef = useRef(pageText);
  useEffect(() => {
    pageTextRef.current = pageText;
  });
  const readSelection = useCallback(() => {
    const current = window.getSelection();
    const article = articleRef.current;
    if (!current || current.isCollapsed || current.rangeCount === 0 || !article) {
      setSelection(null);
      return;
    }
    const range = current.getRangeAt(0);
    const found = selectionOnPage(article, range, pageTextRef.current);
    setSelection(found ? { ...found, rect: range.getBoundingClientRect() } : null);
    setSelectionError(null);
  }, []);
  useEffect(() => {
    // While a finger or mouse is still dragging, wait for it to lift.
    const onChange = () => {
      if (!pointerDown.current) readSelection();
    };
    const onUp = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      requestAnimationFrame(readSelection);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [readSelection]);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setSelectionError(null);
  }, []);

  const highlightSelection = async (color: HighlightColor, withNote: boolean) => {
    if (!selection) return;
    setSelectionBusy(true);
    setSelectionError(null);
    try {
      const saved = await study.add({
        chapterIndex: page.chapterIndex,
        page: page.page,
        start: selection.start,
        end: selection.end,
        quote: selection.quote,
        color,
        note: null,
      });
      clearSelection();
      if (withNote) setEditing({ id: saved.id, focusNote: true });
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : "We couldn't save the highlight. Try again.");
    } finally {
      setSelectionBusy(false);
    }
  };

  const goTo = (next: number) => {
    const clamped = Math.min(total - 1, Math.max(0, next));
    setIndex(clamped);
    clearSelection();
    pageRef.current?.scrollTo({ top: 0 });
    const target = pages[clamped];
    setOwnFraction(pageFraction(clamped, total));
    reading.save({ format: "ebook", fraction: pageFraction(clamped, total), chapterIndex: target.chapterIndex });
  };

  const next = () => (index === total - 1 ? setAsking(true) : goTo(index + 1));
  const previous = () => goTo(index - 1);

  const finish = () => {
    setAsking(false);
    setFinished(true);
    setOwnFraction(1);
    reading.save({ format: "ebook", fraction: 1, chapterIndex: book.chapters.length - 1, finished: true });
  };

  // Arrow keys and Page Up/Down turn pages, unless a control that uses them has focus.
  const latest = useRef({ next, previous });
  useEffect(() => {
    latest.current = { next, previous };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, dialog") || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") latest.current.next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") latest.current.previous();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    pointerDown.current = true;
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || window.getSelection()?.toString()) return;
    // A tap or click on a highlight opens it.
    const mark = (e.target as Element).closest?.<HTMLElement>("mark[data-highlight]");
    if (mark && Math.abs(e.clientX - start.x) < 10 && Math.abs(e.clientY - start.y) < 10) {
      setEditing({ id: mark.dataset.highlight!, focusNote: false });
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else previous();
      return;
    }
    // A tap: the outer fifths turn the page, the middle brings the controls back.
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const zone = (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth;
      if (e.pointerType !== "mouse" && zone < 0.2) previous();
      else if (e.pointerType !== "mouse" && zone > 0.8) next();
      else show();
    }
  };

  if (limit.reached && limit.limitMinutes !== null) {
    return <DailyLimitReached limitMinutes={limit.limitMinutes} onAllowMore={limit.allowMore} />;
  }

  const style = {
    "--reader-size": `${READER_SIZES[settings.size]}px`,
    "--reader-leading": LINE_HEIGHTS[settings.spacing],
    "--reader-measure": MEASURES[settings.margins],
  } as CSSProperties;
  const percent = Math.round(pageFraction(index, total) * 100);
  // Saved places are rounded to four decimals, so a difference smaller than that is this reader's own.
  const elsewhere = reading.progress && !finished && Math.abs(reading.progress.fraction - ownFraction) > 0.0001 ? reading.progress : null;
  const isHereMarked = reading.bookmarks.some((b) => b.format === "ebook" && pageForFraction(b.fraction, total) === index);

  return (
    <div
      className={`reader reader-theme-${settings.theme} reader-font-${settings.font}${visible ? "" : " controls-hidden"}`}
      style={style}
      onPointerMove={(e) => e.pointerType === "mouse" && show()}
      onFocus={show}
    >
      <header className="reader-bar reader-top">
        <Link className="icon-button" to={`/books/${book.id}`}>
          <Icon name="arrowLeft" size={20} />
          <span className="visually-hidden">Close the reader</span>
        </Link>
        <div className="reader-heading">
          <h1>{book.title}</h1>
          <p>{chapter.title}</p>
        </div>
        <div className="reader-tools">
          <button type="button" className="icon-button" onClick={() => setPanel("chapters")}>
            <Icon name="list" size={20} />
            <span className="visually-hidden">Chapters</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("highlights")}>
            <Icon name="highlighter" size={20} />
            <span className="visually-hidden">Notes and highlights ({study.highlights.length})</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("bookmarks")}>
            <Icon name="bookmark" size={20} filled={isHereMarked} />
            <span className="visually-hidden">Bookmarks{isHereMarked ? " (this page is bookmarked)" : ""}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setDictionaryWord("");
              setPanel("dictionary");
            }}
          >
            <Icon name="dictionary" size={20} />
            <span className="visually-hidden">Dictionary</span>
          </button>
          {/* Not on Kids profiles: a child's question would go to an AI service. */}
          {book.recording && profile?.ageRating !== "kids" && (
            <button type="button" className="icon-button" onClick={() => setPanel("ask")}>
              <Icon name="ask" size={20} />
              <span className="visually-hidden">Ask the book</span>
            </button>
          )}
          {/* Not on Kids profiles either: it's written by an AI service from the book. */}
          {book.recording && profile?.ageRating !== "kids" && (
            <button type="button" className="icon-button" onClick={() => setPanel("characters")}>
              <Icon name="users" size={20} />
              <span className="visually-hidden">Who's who</span>
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => setPanel("display")}>
            <Icon name="type" size={20} />
            <span className="visually-hidden">Display settings</span>
          </button>
        </div>
      </header>

      {reading.saveError && (
        <p className="reader-save-error" role="alert">
          <Icon name="alert" size={15} /> {reading.saveError}
        </p>
      )}

      {elsewhere && (
        <div className="reader-elsewhere" role="status">
          <p>
            On another device you {elsewhere.format === "ebook" ? "read" : "listened"} to{" "}
            {elsewhere.finished ? "the end" : `${book.chapters[elsewhere.chapterIndex]?.title ?? "later on"} (${Math.round(elsewhere.fraction * 100)}%)`}.
          </p>
          <button
            type="button"
            className="primary-button small-button"
            onClick={() =>
              goTo(elsewhere.format === "ebook" || elsewhere.finished ? pageForFraction(elsewhere.fraction, total) : (starts[elsewhere.chapterIndex] ?? 0))
            }
          >
            Go there
          </button>
          <button type="button" className="ghost-button small-button" onClick={() => setOwnFraction(elsewhere.fraction)}>
            Stay here
          </button>
        </div>
      )}

      <main className="reader-stage">
        {finished ? (
          <FinishedPanel
            book={book}
            onRestart={() => {
              setFinished(false);
              goTo(0);
            }}
          />
        ) : (
          <div
            ref={pageRef}
            className="reader-page"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <article
              ref={articleRef}
              className="reader-text"
              lang="en"
              aria-label={`${chapter.title}, page ${page.page + 1} of ${pagesInChapter}`}
            >
              {page.page === 0 && (
                <h2 className="reader-chapter-title">
                  <span>Chapter {page.chapterIndex + 1}</span>
                  {chapter.title !== `Chapter ${page.chapterIndex + 1}` && chapter.title}
                </h2>
              )}
              {paragraphs.map((paragraph, i) => {
                let at = offsets[i];
                return (
                  <p key={i} data-offset={offsets[i]}>
                    {paragraphSegments(paragraph, offsets[i], pageHighlights).map((segment, j) => {
                      at += segment.text.length;
                      const h = segment.highlight;
                      if (!h) return segment.text;
                      // The note mark goes after the highlight's last run.
                      const ends = at >= h.end;
                      return (
                        <mark key={j} className={`hl hl-${h.color}${h.note ? " hl-has-note" : ""}${ends ? " hl-end" : ""}`} data-highlight={h.id}>
                          {segment.text}
                        </mark>
                      );
                    })}
                  </p>
                );
              })}
            </article>
          </div>
        )}
      </main>

      <footer className="reader-bar reader-bottom">
        <div className="reader-progress-row">
          <button type="button" className="icon-button page-turn" onClick={previous} disabled={index === 0 || finished}>
            <Icon name="chevronLeft" size={22} />
            <span className="visually-hidden">Previous page</span>
          </button>
          <div className="progress-track">
            <span className="chapter-marks" aria-hidden="true">
              {starts.slice(1).map((start, i) => (
                <span key={i} style={{ left: `${(start / (total - 1)) * 100}%` }} />
              ))}
            </span>
            <input
              type="range"
              className="progress-range"
              min={1}
              max={total}
              value={index + 1}
              aria-label="Page"
              aria-valuetext={`Page ${index + 1} of ${total}, ${chapter.title}`}
              style={{ "--fill": `${(index / (total - 1)) * 100}%` } as CSSProperties}
              onChange={(e) => {
                const value = Number(e.target.value) - 1;
                goTo(value);
                // Reaching the end asks first, so a stray drag doesn't finish the book.
                if (value === total - 1) setAsking(true);
              }}
            />
          </div>
          <button type="button" className="icon-button page-turn" onClick={next} disabled={finished}>
            <Icon name="chevronRight" size={22} />
            <span className="visually-hidden">{index === total - 1 ? "Finish the book" : "Next page"}</span>
          </button>
        </div>
        <p className="reader-position">
          <span>{chapter.title}</span>
          <span>
            Page {index + 1} of {total} · {percent}%
          </span>
        </p>
        <p className="reader-sample-note">
          {book.recording
            ? "Public-domain text from Project Gutenberg."
            : "Sample pages: LiteraryWorm doesn't hold this book's text yet, so the reader shows placeholder prose."}
        </p>
      </footer>

      <p className="visually-hidden" role="status">
        Page {index + 1} of {total}, {chapter.title}
      </p>

      <ChaptersDialog
        open={panel === "chapters"}
        onClose={() => setPanel(null)}
        book={book}
        current={page.chapterIndex}
        detail={(i) => `Page ${starts[i] + 1}`}
        onPick={(i) => {
          setPanel(null);
          goTo(starts[i]);
        }}
      />
      <BookmarksDialog
        open={panel === "bookmarks"}
        onClose={() => setPanel(null)}
        bookmarks={reading.bookmarks}
        hereLabel={hereLabel}
        isHereMarked={isHereMarked}
        onAdd={() =>
          reading.addBookmark({ format: "ebook", fraction: pageFraction(index, total), chapterIndex: page.chapterIndex, label: hereLabel })
        }
        onGo={(b) => {
          setPanel(null);
          goTo(pageForFraction(b.fraction, total));
        }}
        onRemove={(b) => reading.removeBookmark(b.id)}
      />
      <ReaderDisplayDialog open={panel === "display"} onClose={() => setPanel(null)} />
      <HighlightsDialog
        open={panel === "highlights"}
        book={book}
        highlights={study.highlights}
        onClose={() => setPanel(null)}
        onGo={(h) => {
          setPanel(null);
          goTo(starts[h.chapterIndex] + h.page);
        }}
        onEdit={(h) => {
          setPanel(null);
          setEditing({ id: h.id, focusNote: true });
        }}
        onRemove={study.remove}
        onShare={(h) => {
          setPanel(null);
          setSharing(h);
        }}
      />
      <HighlightDialog
        highlight={editingHighlight}
        focusNote={editing?.focusNote ?? false}
        onClose={() => setEditing(null)}
        onUpdate={study.update}
        onRemove={study.remove}
        onShare={(h) => {
          setEditing(null);
          setSharing(h);
        }}
      />
      <QuoteCardDialog book={book} highlight={sharing} onClose={() => setSharing(null)} />
      <DictionaryDialog open={panel === "dictionary"} word={dictionaryWord} onClose={() => setPanel(null)} />
      {book.recording && profile?.ageRating !== "kids" && <AskDialog open={panel === "ask"} book={book} chapterIndex={page.chapterIndex} onClose={() => setPanel(null)} />}
      {book.recording && profile?.ageRating !== "kids" && (
        <CharactersDialog open={panel === "characters"} book={book} chapterIndex={page.chapterIndex} onClose={() => setPanel(null)} />
      )}
      {selection && !finished && (
        <SelectionToolbar
          rect={selection.rect}
          canDefine={singleWord(selection.quote) !== null}
          error={selectionError}
          busy={selectionBusy}
          onHighlight={(color) => highlightSelection(color, false)}
          onNote={() => highlightSelection("yellow", true)}
          onDefine={() => {
            setDictionaryWord(singleWord(selection.quote) ?? "");
            clearSelection();
            setPanel("dictionary");
          }}
          onDismiss={clearSelection}
        />
      )}
      <MarkFinishedDialog open={asking} title={book.title} onFinish={finish} onCancel={() => setAsking(false)} />
    </div>
  );
}
