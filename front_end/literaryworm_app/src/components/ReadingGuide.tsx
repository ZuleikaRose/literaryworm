import { type RefObject, useCallback, useEffect, useState } from "react";
import { guideBand, lineAt, type ReadingGuide as Mode, stepLine, type TextBox } from "../lib/readingGuide";

/**
 * The reader's reading guide over the page (lib/readingGuide.ts): a ruler on one line, or line
 * focus dimming everything outside a window of lines. It moves to the line under the pointer (or
 * a tap); `step` (from J and K) moves it a line. Decorative only: hidden from screen readers, and
 * it never takes clicks, so selecting and highlighting work as before. Starts on the first line
 * of each page (`pageKey`).
 */
export function ReadingGuide({
  mode,
  pageRef,
  textRef,
  pageKey,
  step,
}: {
  mode: Exclude<Mode, "off">;
  pageRef: RefObject<HTMLDivElement | null>;
  textRef: RefObject<HTMLElement | null>;
  pageKey: string;
  /** A counter and direction: each change moves the guide one line. */
  step: { n: number; dir: 1 | -1 };
}) {
  const [line, setLine] = useState<{ key: string; top: number } | null>(null);
  const [scrollHeight, setScrollHeight] = useState(0);

  const box = useCallback((): TextBox | null => {
    const page = pageRef.current;
    const text = textRef.current;
    if (!page || !text) return null;
    // Lines start at the first paragraph (a chapter heading above it has its own size).
    const first = text.querySelector("p") ?? text;
    const style = getComputedStyle(first);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
    const pageTop = page.getBoundingClientRect().top - page.scrollTop;
    const top = first.getBoundingClientRect().top - pageTop;
    const bottom = text.getBoundingClientRect().bottom - pageTop;
    return { top, height: Math.max(lineHeight, bottom - top), lineHeight };
  }, [pageRef, textRef]);

  // Follow the pointer (mouse, pen or a tap) over the page.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const move = (e: PointerEvent) => {
      const b = box();
      if (!b) return;
      const y = e.clientY - page.getBoundingClientRect().top + page.scrollTop;
      setLine({ key: pageKey, top: lineAt(y, b) });
      setScrollHeight(page.scrollHeight);
    };
    page.addEventListener("pointermove", move);
    page.addEventListener("pointerdown", move);
    return () => {
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerdown", move);
    };
  }, [pageRef, box, pageKey]);

  // J and K.
  useEffect(() => {
    if (step.n === 0) return;
    const b = box();
    if (!b) return;
    setLine((current) => ({ key: pageKey, top: stepLine(current?.key === pageKey ? current.top : b.top, step.dir, b) }));
    setScrollHeight(pageRef.current?.scrollHeight ?? 0);
    // Only a new step moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.n]);

  // Measure once the page is laid out, so a new page starts on its first line.
  useEffect(() => {
    const id = requestAnimationFrame(() => setScrollHeight(pageRef.current?.scrollHeight ?? 0));
    return () => cancelAnimationFrame(id);
  }, [pageKey, pageRef]);

  const b = box();
  if (!b) return null;
  const top = line?.key === pageKey ? line.top : b.top;
  const band = guideBand(mode, top, b);
  if (mode === "ruler") {
    return <div className="reading-guide reading-guide-ruler" aria-hidden="true" data-testid="reading-guide" style={{ top: band.top, height: band.height }} />;
  }
  const below = band.top + band.height;
  return (
    <>
      <div className="reading-guide reading-guide-dim" aria-hidden="true" data-testid="reading-guide" style={{ top: 0, height: Math.max(0, band.top) }} />
      <div className="reading-guide reading-guide-dim" aria-hidden="true" style={{ top: below, height: Math.max(0, Math.max(scrollHeight, below) - below) }} />
    </>
  );
}
