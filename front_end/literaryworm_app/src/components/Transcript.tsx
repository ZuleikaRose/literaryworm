import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { chapterTranscript, lineAt, TRANSCRIPT_LANGUAGES, TRANSCRIPT_SIZES } from "../lib/transcript";
import { useStore } from "../store/context";
import type { A11ySettings, Book } from "../types";

const prefersStill = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");

/**
 * The read-along transcript for the chapter that's playing. The sentence being read is marked
 * and kept in view (unless *Follow the narration* is off); choosing a sentence jumps there.
 * Only the current sentence is in the Tab order; the up and down arrows move between sentences,
 * and Enter or Space jumps there. Sentences are inline spans with the button role (a real
 * <button> can't flow as running text), so they keep the paragraph's shape.
 */
export function Transcript({ book, chapterIndex, position, onSeek }: { book: Book; chapterIndex: number; position: number; onSeek: (seconds: number) => void }) {
  const { state, dispatch } = useStore();
  const { transcriptSize: size, transcriptLanguage: language } = state.a11y;
  const set = (patch: Partial<A11ySettings>) => dispatch({ type: "updateA11y", patch });
  const [follow, setFollow] = useState(true);
  const headingId = useId();
  const scroller = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => chapterTranscript(book, chapterIndex, language), [book, chapterIndex, language]);
  const current = lineAt(lines, position);

  // Keep the sentence being read in the middle of the box.
  useEffect(() => {
    const box = scroller.current;
    const line = box?.querySelector<HTMLElement>(`[data-line="${current}"]`);
    if (!follow || !box || !line) return;
    const top = line.offsetTop - box.clientHeight / 2 + line.offsetHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: prefersStill() ? "auto" : "smooth" });
  }, [current, follow, size, language]);

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSeek(lines[index].start);
      return;
    }
    const next = e.key === "ArrowDown" ? index + 1 : e.key === "ArrowUp" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? lines.length - 1 : null;
    if (next === null || next < 0 || next >= lines.length) return;
    e.preventDefault();
    scroller.current?.querySelector<HTMLElement>(`[data-line="${next}"]`)?.focus();
  };

  // Sentences grouped back into their paragraphs.
  const paragraphs: number[][] = [];
  lines.forEach((line, i) => {
    if (line.opensParagraph || paragraphs.length === 0) paragraphs.push([i]);
    else paragraphs[paragraphs.length - 1].push(i);
  });
  const focusable = current >= 0 ? current : 0;

  return (
    <section className={`transcript transcript-${size}`} aria-labelledby={headingId}>
      <div className="transcript-head">
        <h2 id={headingId}>Read-along</h2>
        <label className="transcript-follow">
          <input type="checkbox" role="switch" className="switch" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          <span>Follow the narration</span>
        </label>
        <label className="player-select transcript-select">
          <span>Language</span>
          <select value={language} onChange={(e) => set({ transcriptLanguage: e.target.value as A11ySettings["transcriptLanguage"] })}>
            {TRANSCRIPT_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value} lang={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="player-select transcript-select">
          <span>Size</span>
          <select value={size} onChange={(e) => set({ transcriptSize: e.target.value as A11ySettings["transcriptSize"] })}>
            {TRANSCRIPT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={scroller} className="transcript-box" lang={language}>
        {paragraphs.map((indexes) => (
          <p key={indexes[0]}>
            {indexes.map((i) => (
              <span
                key={i}
                role="button"
                className="transcript-line"
                data-line={i}
                tabIndex={i === focusable ? 0 : -1}
                aria-current={i === current ? "true" : undefined}
                onClick={() => onSeek(lines[i].start)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {lines[i].text}{" "}
              </span>
            ))}
          </p>
        ))}
      </div>
      <p className="transcript-note">Sample transcript: placeholder text timed to the sample clock. Choose a sentence to jump there.</p>
    </section>
  );
}
