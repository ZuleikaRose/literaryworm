/**
 * The reader's keyboard shortcuts. They work whenever focus isn't in a field or a dialog, and
 * never with Ctrl, Alt or Cmd held, so the browser's own shortcuts still work.
 */
import { tk } from "./i18n";

export type ReaderAction = "next" | "previous" | "chapters" | "highlights" | "bookmark" | "dictionary" | "display" | "help" | "guideDown" | "guideUp";

export const READER_SHORTCUTS: { keys: string[]; label: string; action: ReaderAction }[] = [
  { keys: ["→", "Page Down"], label: tk("Next page"), action: "next" },
  { keys: ["←", "Page Up"], label: tk("Previous page"), action: "previous" },
  { keys: ["C"], label: tk("Chapters"), action: "chapters" },
  { keys: ["N"], label: tk("Notes and highlights"), action: "highlights" },
  { keys: ["B"], label: tk("Bookmark this page, or remove its bookmark"), action: "bookmark" },
  { keys: ["D"], label: tk("Dictionary"), action: "dictionary" },
  { keys: ["T"], label: tk("Display settings"), action: "display" },
  { keys: ["J"], label: tk("Move the reading guide down a line (when it's on)"), action: "guideDown" },
  { keys: ["K"], label: tk("Move the reading guide up a line (when it's on)"), action: "guideUp" },
  { keys: ["?"], label: tk("These shortcuts"), action: "help" },
];

/** The action for a key press, or null. */
export function readerAction(e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): ReaderAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  switch (e.key) {
    case "ArrowRight":
    case "PageDown":
      return "next";
    case "ArrowLeft":
    case "PageUp":
      return "previous";
    case "?":
      return "help";
  }
  const letter = e.key.length === 1 ? e.key.toLowerCase() : "";
  return ({ c: "chapters", n: "highlights", b: "bookmark", d: "dictionary", t: "display", j: "guideDown", k: "guideUp" } as Record<string, ReaderAction>)[letter] ?? null;
}
