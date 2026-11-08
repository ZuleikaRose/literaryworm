import { bookLangTag } from "../lib/languages";
import { type CSSProperties, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { TranslateDialog } from "../components/TranslateDialog";
import { usesBackend } from "../lib/backend";
import { CharactersDialog } from "../components/CharactersDialog";
import { ReaderDisplayDialog } from "../components/ReaderDisplayDialog";
import { QuoteCardDialog } from "../components/QuoteCardDialog";
import { DictionaryDialog, HighlightDialog, HighlightsDialog, SelectionToolbar } from "../components/StudyTools";
import { samplePage } from "../data/sampleText";
import { type PageSelection, paragraphOffsets, paragraphSegments, selectionOnPage, singleWord } from "../lib/highlights";
import { usePlayback } from "../lib/playback";
import { useReaderReadAloud } from "../lib/useReaderReadAloud";
import { ContinueDialog } from "../components/ContinueOnPhone";
import { readerContinueUrl } from "../lib/continueLink";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { chapterStarts, linkedPage, pageForFraction, pageFraction, PLAYBACK_SPEEDS, READER_SIZES, type ReaderPage } from "../lib/reading";
import { useBookPages } from "../lib/useBookPages";
import { useControlsVisibility } from "../lib/useControlsVisibility";
import { useDailyLimit } from "../lib/useDailyLimit";
import { useHighlights } from "../lib/useHighlights";
import { useReading } from "../lib/useReading";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { sentenceAround, type WordSource } from "../lib/words";
import { countWords, formatTimeLeft, readingSecondsLeft } from "../lib/pace";
import { useReadingPace } from "../lib/useReadingPace";
import { readerAction } from "../lib/shortcuts";
import { ShortcutsDialog } from "../components/ShortcutsDialog";
import { QuizDialog } from "../components/QuizDialog";
import { ReadingGuide } from "../components/ReadingGuide";
import { useActiveProfile, useProfileData } from "../store/context";
import { countPage } from "../lib/sprintCounter";
import { SprintChip } from "../components/SprintChip";
import type { Book, Highlight, HighlightColor } from "../types";

type Panel = "chapters" | "bookmarks" | "display" | "highlights" | "dictionary" | "ask" | "characters" | "shortcuts" | "quiz" | "continue" | null;

export default function Reader() {
  return <ReadingGate format="ebook">{(book) => <ReaderPages key={book.id} book={book} />}</ReadingGate>;
}

/** Loads the book's pages (real text for public-domain titles), then opens the reader. */
function ReaderPages({ book }: { book: Book }) {
  const t = useT();
  const { pages, error, retry } = useBookPages(book);
  if (error) {
    return (
      <ReadingMessage
        title={t("We couldn't open {title}", { title: book.title })}
        icon="bookOpen"
        action={
          <button type="button" className="primary-button" onClick={retry}>
            {t("Try again")}
          </button>
        }
      >
        <p>{error}</p>
      </ReadingMessage>
    );
  }
  if (!pages) {
    return (
      <ReadingMessage title={t("Opening {title}", { title: book.title })} icon="bookOpen">
        <p role="status">{t("Loading the book's text…")}</p>
      </ReadingMessage>
    );
  }
  return <ReaderView book={book} pages={pages} />;
}

const LINE_HEIGHTS = { compact: 1.45, normal: 1.65, relaxed: 1.9 };
const MEASURES = { narrow: "44rem", normal: "38rem", wide: "32rem" };

function ReaderView({ book, pages }: { book: Book; pages: ReaderPage[] }) {
  const t = useT();
  useTitle(t("Reading {title}", { title: book.title }));
  const settings = useProfileData().readerSettings;
  const profile = useActiveProfile();
  // Translate: public-domain titles (full text on the server), not Kids profiles, with the backend.
  const canTranslate = Boolean(book.recording) && profile?.ageRating !== "kids" && usesBackend;
  const reading = useReading(book);
  const study = useHighlights(book, reading.addToLibrary);
  const playback = usePlayback();
  const starts = chapterStarts(pages);
  const total = pages.length;
  // Counted towards this book's statistics too, with the page the reader is on.
  const limit = useDailyLimit(true, undefined, false, () => ({ bookId: book.id, fraction: total ? index / total : null }));

  // A link to a passage (?chapter=&page=, from highlights review) opens there; otherwise start where
  // the account stopped (unless the book was finished: then from the start). The saved place moves
  // only when the reader turns a page.
  const [params] = useSearchParams();
  const [index, setIndex] = useState(
    () =>
      linkedPage(starts, total, params.get("chapter"), params.get("page")) ??
      (reading.progress && !reading.progress.finished ? pageForFraction(reading.progress.fraction, total) : 0),
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
  // Translate (lib/translateApi.ts): the selected words, while the dialog is open.
  const [translating, setTranslating] = useState<string | null>(null);
  const [dictionarySource, setDictionarySource] = useState<WordSource | null>(null);
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
  const hereLabel = t("Chapter {chapter}, page {page}", { chapter: page.chapterIndex + 1, page: page.page + 1 });
  // Saved with the bookmark, so kept in English like the player's (every device shows the same label).
  const bookmarkLabel = `Chapter ${page.chapterIndex + 1}, page ${page.page + 1}`;
  const paragraphs = page.paragraphs ?? samplePage(book.id, page.chapterIndex, page.page);
  const offsets = paragraphOffsets(paragraphs);
  // Words on every page, for time left (sample pages are made up of the same placeholder prose).
  const pageWords = useMemo(
    () => pages.map((p) => countWords(p.paragraphs ?? samplePage(book.id, p.chapterIndex, p.page))),
    [pages, book.id],
  );
  const wpm = useReadingPace(index, pageWords[index] ?? 0);
  const wordsLeftInChapter = pageWords.reduce((n, w, i) => (i >= index && pages[i].chapterIndex === page.chapterIndex ? n + w : n), 0);
  const wordsLeftInBook = pageWords.reduce((n, w, i) => (i >= index ? n + w : n), 0);
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
      setSelectionError(err instanceof Error ? err.message : t("We couldn't save the highlight. Try again."));
    } finally {
      setSelectionBusy(false);
    }
  };

  const goTo = (next: number) => {
    const clamped = Math.min(total - 1, Math.max(0, next));
    // A page read forward counts towards a reading sprint this profile is in.
    if (clamped === index + 1) countPage(profile?.id);
    setIndex(clamped);
    clearSelection();
    pageRef.current?.scrollTo({ top: 0 });
    const target = pages[clamped];
    setOwnFraction(pageFraction(clamped, total));
    reading.save({ format: "ebook", fraction: pageFraction(clamped, total), chapterIndex: target.chapterIndex });
  };

  // Read aloud (uploads with a natural voice): the voice reads on from this page, turning the pages.
  const readAloud = useReaderReadAloud(book, pages, index, goTo, articleRef);
  const { player: readerPlayer, update: updatePlayer } = usePlayerSettings(book?.id ?? null);
  const next = () => (index === total - 1 ? setAsking(true) : goTo(index + 1));
  const previous = () => goTo(index - 1);

  const finish = () => {
    setAsking(false);
    setFinished(true);
    setOwnFraction(1);
    reading.save({ format: "ebook", fraction: 1, chapterIndex: book.chapters.length - 1, finished: true });
  };

  // Keyboard shortcuts (lib/shortcuts.ts): arrows and Page Up/Down turn pages, letters open the
  // panels, ? lists them; not while a control that uses keys has focus, or a dialog is open.
  const toggleBookmark = () => {
    const here = reading.bookmarks.find((b) => b.format === "ebook" && pageForFraction(b.fraction, total) === index);
    if (here) void reading.removeBookmark(here.id).catch(() => undefined);
    else
      void reading
        .addBookmark({ format: "ebook", fraction: pageFraction(index, total), chapterIndex: page.chapterIndex, label: bookmarkLabel })
        .catch(() => undefined);
  };
  const latest = useRef({ next, previous, toggleBookmark, finished });
  // The reading guide (Display → Reading guide): J and K move it a line.
  const [guideStep, setGuideStep] = useState<{ n: number; dir: 1 | -1 }>({ n: 0, dir: 1 });
  const latestGuide = useRef(settings.guide);
  useEffect(() => {
    latestGuide.current = settings.guide;
  });
  useEffect(() => {
    latest.current = { next, previous, toggleBookmark, finished };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, dialog, [contenteditable]") || document.querySelector("dialog[open]")) return;
      const action = readerAction(e);
      if (!action) return;
      const l = latest.current;
      if (action === "guideDown" || action === "guideUp") {
        // Only while the reading guide is on (Display); otherwise the keys do nothing.
        if (latestGuide.current === "off") return;
        setGuideStep((s) => ({ n: s.n + 1, dir: action === "guideDown" ? 1 : -1 }));
      } else if (action === "next") l.next();
      else if (action === "previous") l.previous();
      else if (action === "bookmark") {
        if (!l.finished) l.toggleBookmark();
      } else if (action === "dictionary") {
        setDictionaryWord("");
        setPanel("dictionary");
      } else setPanel(action === "help" ? "shortcuts" : action);
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

  if (limit.bedtime) return <DailyLimitReached limitMinutes={limit.limitMinutes} wake={limit.bedtime} onAllowMore={limit.allowMore} />;
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
          <span className="visually-hidden">{t("Close the reader")}</span>
        </Link>
        <div className="reader-heading">
          <h1>{book.title}</h1>
          <p>{chapter.title}</p>
          <SprintChip />
        </div>
        <div className="reader-tools">
          <button type="button" className="icon-button" onClick={() => setPanel("chapters")}>
            <Icon name="list" size={20} />
            <span className="visually-hidden">{t("Chapters")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("highlights")}>
            <Icon name="highlighter" size={20} />
            <span className="visually-hidden">{t("Notes and highlights ({n})", { n: study.highlights.length })}</span>
          </button>
          {readAloud.offered && (
            <button type="button" className="icon-button" aria-pressed={readAloud.on} onClick={readAloud.on ? readAloud.stop : readAloud.start}>
              <Icon name={readAloud.on ? "pause" : "headphones"} size={20} />
              <span className="visually-hidden">{readAloud.on ? t("Stop reading aloud") : t("Read aloud, marking each word")}</span>
            </button>
          )}
          {readAloud.on && (
            // The player's own speed (per book when it keeps one), so both stay the same.
            <label className="reader-speed">
              <span className="visually-hidden">{t("Reading aloud speed")}</span>
              <select value={readerPlayer.speed} onChange={(e) => updatePlayer({ speed: Number(e.target.value) })}>
                {PLAYBACK_SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="icon-button" onClick={() => setPanel("continue")}>
            <Icon name="qr" size={20} />
            <span className="visually-hidden">{t("Continue on your phone")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("bookmarks")}>
            <Icon name="bookmark" size={20} filled={isHereMarked} />
            <span className="visually-hidden">{isHereMarked ? t("Bookmarks (this page is bookmarked)") : t("Bookmarks")}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setDictionaryWord("");
              setDictionarySource({ bookId: book.id, chapterIndex: page.chapterIndex, page: page.page, context: null });
              setPanel("dictionary");
            }}
          >
            <Icon name="dictionary" size={20} />
            <span className="visually-hidden">{t("Dictionary")}</span>
          </button>
          {/* Not on Kids profiles: a child's question would go to an AI service. */}
          {book.recording && profile?.ageRating !== "kids" && (
            <button type="button" className="icon-button" onClick={() => setPanel("ask")}>
              <Icon name="ask" size={20} />
              <span className="visually-hidden">{t("Ask the book")}</span>
            </button>
          )}
          {/* Not on Kids profiles either: it's written by an AI service from the book. */}
          {book.recording && profile?.ageRating !== "kids" && (
            <button type="button" className="icon-button" onClick={() => setPanel("characters")}>
              <Icon name="users" size={20} />
              <span className="visually-hidden">{t("Who's who")}</span>
            </button>
          )}
          {/* Every profile, Kids too: only the book and chapter go to the AI service. */}
          {book.recording && (
            <button type="button" className="icon-button" onClick={() => setPanel("quiz")}>
              <Icon name="star" size={20} />
              <span className="visually-hidden">{t("Chapter quiz")}</span>
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => setPanel("display")}>
            <Icon name="type" size={20} />
            <span className="visually-hidden">{t("Display settings")}</span>
          </button>
          <button type="button" className="icon-button reader-shortcuts-button" onClick={() => setPanel("shortcuts")}>
            <Icon name="keyboard" size={20} />
            <span className="visually-hidden">{t("Keyboard shortcuts")}</span>
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
            {elsewhere.finished
              ? elsewhere.format === "ebook"
                ? t("On another device you read to the end.")
                : t("On another device you listened to the end.")
              : elsewhere.format === "ebook"
                ? t("On another device you read to {place} ({percent}%).", {
                    place: book.chapters[elsewhere.chapterIndex]?.title ?? t("later on"),
                    percent: Math.round(elsewhere.fraction * 100),
                  })
                : t("On another device you listened to {place} ({percent}%).", {
                    place: book.chapters[elsewhere.chapterIndex]?.title ?? t("later on"),
                    percent: Math.round(elsewhere.fraction * 100),
                  })}
          </p>
          <button
            type="button"
            className="primary-button small-button"
            onClick={() =>
              goTo(elsewhere.format === "ebook" || elsewhere.finished ? pageForFraction(elsewhere.fraction, total) : (starts[elsewhere.chapterIndex] ?? 0))
            }
          >
            {t("Go there")}
          </button>
          <button type="button" className="ghost-button small-button" onClick={() => setOwnFraction(elsewhere.fraction)}>
            {t("Stay here")}
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
              lang={bookLangTag(book.language)}
              // The book's own direction, whatever the app's language (Arabic sets the page right to left).
              dir="auto"
              aria-label={t("{chapter}, page {page} of {pages}", { chapter: chapter.title, page: page.page + 1, pages: pagesInChapter })}
            >
              {page.page === 0 && (
                <h2 className="reader-chapter-title">
                  <span>{t("Chapter {n}", { n: page.chapterIndex + 1 })}</span>
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
            {settings.guide !== "off" && (
              <ReadingGuide mode={settings.guide} pageRef={pageRef} textRef={articleRef} pageKey={`${index}`} step={guideStep} />
            )}
          </div>
        )}
      </main>

      <footer className="reader-bar reader-bottom">
        <div className="reader-progress-row">
          <button type="button" className="icon-button page-turn" onClick={previous} disabled={index === 0 || finished}>
            <Icon name="chevronLeft" size={22} />
            <span className="visually-hidden">{t("Previous page")}</span>
          </button>
          <div className="progress-track">
            <span className="chapter-marks" aria-hidden="true">
              {starts.slice(1).map((start, i) => (
                <span key={i} style={{ insetInlineStart: `${(start / (total - 1)) * 100}%` }} />
              ))}
            </span>
            <input
              type="range"
              className="progress-range"
              min={1}
              max={total}
              value={index + 1}
              aria-label={t("Page")}
              aria-valuetext={t("Page {page} of {total}, {chapter}", { page: index + 1, total, chapter: chapter.title })}
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
            <span className="visually-hidden">{index === total - 1 ? t("Finish the book") : t("Next page")}</span>
          </button>
        </div>
        <p className="reader-position">
          <span>{chapter.title}</span>
          <span>{t("Page {page} of {total} · {percent}%", { page: index + 1, total, percent })}</span>
        </p>
        {!finished && (
          <p className="reader-pace">
            {t("{chapter} left in this chapter · {book} in the book", {
              chapter: formatTimeLeft(readingSecondsLeft(wordsLeftInChapter, wpm)),
              book: formatTimeLeft(readingSecondsLeft(wordsLeftInBook, wpm)),
            })}
            {wpm === null && <span className="visually-hidden"> {t("(at a usual reading pace until LiteraryWorm learns yours)")}</span>}
          </p>
        )}
        <p className="reader-sample-note">
          {book.recording
            ? t("Public-domain text from Project Gutenberg.")
            : t("Sample pages: LiteraryWorm doesn't hold this book's text yet, so the reader shows placeholder prose.")}
        </p>
      </footer>

      <p className="visually-hidden" role="status">
        {t("Page {page} of {total}, {chapter}", { page: index + 1, total, chapter: chapter.title })}
      </p>

      <ChaptersDialog
        open={panel === "chapters"}
        onClose={() => setPanel(null)}
        book={book}
        current={page.chapterIndex}
        detail={(i) => t("Page {n}", { n: starts[i] + 1 })}
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
          reading.addBookmark({ format: "ebook", fraction: pageFraction(index, total), chapterIndex: page.chapterIndex, label: bookmarkLabel })
        }
        onGo={(b) => {
          setPanel(null);
          goTo(pageForFraction(b.fraction, total));
        }}
        onRemove={(b) => reading.removeBookmark(b.id)}
      />
      <ReaderDisplayDialog open={panel === "display"} onClose={() => setPanel(null)} />
      <ShortcutsDialog open={panel === "shortcuts"} onClose={() => setPanel(null)} />
      {panel === "continue" && page && (
        <ContinueDialog open onClose={() => setPanel(null)} url={readerContinueUrl(book.id, page.chapterIndex, page.page)} title={book.title} />
      )}
      {book.recording && <QuizDialog open={panel === "quiz"} book={book} chapterIndex={page.chapterIndex} onClose={() => setPanel(null)} />}
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
      <DictionaryDialog open={panel === "dictionary"} word={dictionaryWord} source={dictionarySource} onClose={() => setPanel(null)} />
      {book.recording && profile?.ageRating !== "kids" && <AskDialog open={panel === "ask"} book={book} chapterIndex={page.chapterIndex} onClose={() => setPanel(null)} />}
      {book.recording && profile?.ageRating !== "kids" && (
        <CharactersDialog open={panel === "characters"} book={book} chapterIndex={page.chapterIndex} onClose={() => setPanel(null)} />
      )}
      {selection && !finished && (
        <SelectionToolbar
          rect={selection.rect}
          canDefine={singleWord(selection.quote) !== null}
          canTranslate={canTranslate}
          onTranslate={() => {
            setTranslating(selection.quote);
            clearSelection();
          }}
          error={selectionError}
          busy={selectionBusy}
          onHighlight={(color) => highlightSelection(color, false)}
          onNote={() => highlightSelection("yellow", true)}
          onDefine={() => {
            setDictionaryWord(singleWord(selection.quote) ?? "");
            setDictionarySource({
              bookId: book.id,
              chapterIndex: page.chapterIndex,
              page: page.page,
              context: sentenceAround(pageText, selection.start, selection.end),
            });
            clearSelection();
            setPanel("dictionary");
          }}
          onDismiss={clearSelection}
        />
      )}
      {canTranslate && <TranslateDialog book={book} chapterIndex={page.chapterIndex} text={translating} onClose={() => setTranslating(null)} />}
      <MarkFinishedDialog open={asking} title={book.title} onFinish={finish} onCancel={() => setAsking(false)} />
    </div>
  );
}
