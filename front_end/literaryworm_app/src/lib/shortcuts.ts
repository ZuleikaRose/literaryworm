/**
 * The reader's keyboard shortcuts. They work whenever focus isn't in a field or a dialog, and
 * never with Ctrl, Alt or Cmd held, so the browser's own shortcuts still work.
 */
export type ReaderAction = "next" | "previous" | "chapters" | "highlights" | "bookmark" | "dictionary" | "display" | "help";

export const READER_SHORTCUTS: { keys: string[]; label: string; action: ReaderAction }[] = [
  { keys: ["→", "Page Down"], label: "Next page", action: "next" },
  { keys: ["←", "Page Up"], label: "Previous page", action: "previous" },
  { keys: ["C"], label: "Chapters", action: "chapters" },
  { keys: ["N"], label: "Notes and highlights", action: "highlights" },
  { keys: ["B"], label: "Bookmark this page, or remove its bookmark", action: "bookmark" },
  { keys: ["D"], label: "Dictionary", action: "dictionary" },
  { keys: ["T"], label: "Display settings", action: "display" },
  { keys: ["?"], label: "These shortcuts", action: "help" },
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
  return ({ c: "chapters", n: "highlights", b: "bookmark", d: "dictionary", t: "display" } as Record<string, ReaderAction>)[letter] ?? null;
}
