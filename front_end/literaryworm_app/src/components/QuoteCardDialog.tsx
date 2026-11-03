import { useCallback } from "react";
import { QUOTE_CARD_THEMES, type QuoteCardTheme, quoteCardBlob, quoteCardFileName } from "../lib/quoteCard";
import type { Book, Highlight } from "../types";
import { Dialog } from "./Dialog";
import { ShareImage } from "./ShareImage";
import { useT } from "../lib/useT";

/**
 * Turns a highlight into a picture to share: a preview, a choice of look, then Share (on
 * devices that can share files), Download, or Copy the quote as text. Nothing is uploaded.
 */
export function QuoteCardDialog({ book, highlight, onClose }: { book: Book; highlight: Highlight | null; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={highlight !== null} onClose={onClose} title={t("Share a quote")} eyebrow={book.title}>
      {highlight && <QuoteCard key={highlight.id} book={book} highlight={highlight} />}
    </Dialog>
  );
}

function QuoteCard({ book, highlight }: { book: Book; highlight: Highlight }) {
  const t = useT();
  const draw = useCallback((theme: QuoteCardTheme) => quoteCardBlob(book, highlight, theme), [book, highlight]);
  return (
    <ShareImage
      themes={QUOTE_CARD_THEMES}
      draw={draw}
      fileName={quoteCardFileName(book)}
      shareTitle={book.title}
      text={`“${highlight.quote.trim()}” — ${book.title}, ${book.author}`}
      copyLabel={t("Copy the quote")}
      copiedMessage={t("Quote copied.")}
    />
  );
}
