/**
 * The reader's reading guide (ReaderSettings.guide): a *ruler* (a tinted band on one line) or
 * *line focus* (everything dimmed but a window of FOCUS_LINES lines), for readers who lose their
 * place, including many with dyslexia. It sits on the line under the pointer, or a tapped line,
 * and J / K move it a line down or up. Positions are in px from the top of the scrolling page;
 * the text's lines are `lineHeight` apart from `textTop`.
 */
export type ReadingGuide = "off" | "ruler" | "focus";

export const FOCUS_LINES = 3;

export interface TextBox {
  /** Where the first line of text starts, and how tall the text is (px). */
  top: number;
  height: number;
  lineHeight: number;
}

/** The top of the line holding `y`, kept within the text. */
export function lineAt(y: number, box: TextBox): number {
  if (!(box.lineHeight > 0) || box.height <= 0 || !Number.isFinite(y)) return box.top;
  const last = box.top + Math.max(0, Math.floor((box.height - 1) / box.lineHeight)) * box.lineHeight;
  const line = box.top + Math.floor((y - box.top) / box.lineHeight) * box.lineHeight;
  return Math.min(last, Math.max(box.top, line));
}

/** The line a step down (1) or up (-1) from `lineTop`, kept within the text. */
export const stepLine = (lineTop: number, step: 1 | -1, box: TextBox) => lineAt(lineTop + step * box.lineHeight + box.lineHeight / 2, box);

/** What's shown for a line: the ruler's band, or line focus's window (the line in the middle of three). */
export function guideBand(mode: Exclude<ReadingGuide, "off">, lineTop: number, box: TextBox): { top: number; height: number } {
  if (mode === "ruler") return { top: lineTop, height: box.lineHeight };
  const height = FOCUS_LINES * box.lineHeight;
  return { top: lineTop - Math.floor(FOCUS_LINES / 2) * box.lineHeight, height };
}
