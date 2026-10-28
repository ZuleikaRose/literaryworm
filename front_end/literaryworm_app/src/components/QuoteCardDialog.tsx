import { useEffect, useId, useState } from "react";
import { QUOTE_CARD_THEMES, type QuoteCardTheme, quoteCardBlob, quoteCardFileName } from "../lib/quoteCard";
import type { Book, Highlight } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * Turns a highlight into a picture to share: a preview, a choice of look, then Share (on
 * devices that can share files), Download, or Copy the quote as text. Nothing is uploaded.
 */
export function QuoteCardDialog({ book, highlight, onClose }: { book: Book; highlight: Highlight | null; onClose: () => void }) {
  return (
    <Dialog open={highlight !== null} onClose={onClose} title="Share a quote" eyebrow={book.title}>
      {highlight && <QuoteCard key={highlight.id} book={book} highlight={highlight} />}
    </Dialog>
  );
}

function QuoteCard({ book, highlight }: { book: Book; highlight: Highlight }) {
  const [theme, setTheme] = useState<QuoteCardTheme>("cover");
  const [card, setCard] = useState<{ theme: QuoteCardTheme; blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const name = useId();

  useEffect(() => {
    let live = true;
    let url: string | null = null;
    quoteCardBlob(book, highlight, theme).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ theme, blob, url });
        setFailed(null);
      },
      (err: Error) => {
        if (live) setFailed(err.message);
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [book, highlight, theme]);

  const ready = card?.theme === theme ? card : null;
  const file = ready ? new File([ready.blob], quoteCardFileName(book), { type: "image/png" }) : null;
  const canShareFile = Boolean(file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
  const text = `“${highlight.quote.trim()}” — ${book.title}, ${book.author}`;

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: book.title, text });
      setStatus("Shared.");
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if ((err as Error).name !== "AbortError") setStatus("We couldn't open sharing. Download the picture instead.");
    }
  };
  const download = () => {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = quoteCardFileName(book);
    a.click();
    setStatus("Picture downloaded.");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Quote copied.");
    } catch {
      setStatus("We couldn't copy the quote. Select it and copy it instead.");
    }
  };

  return (
    <div className="quote-card">
      <fieldset className="segmented">
        <legend className="field-label">Look</legend>
        <div>
          {QUOTE_CARD_THEMES.map((t) => (
            <label key={t.value}>
              <input type="radio" name={name} value={t.value} checked={theme === t.value} onChange={() => setTheme(t.value)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quote-card-preview" aria-busy={!ready && !failed}>
        {failed ? (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {failed}
          </p>
        ) : ready ? (
          <img src={ready.url} width={1080} height={1350} alt={`Picture of the quote: ${text}`} />
        ) : (
          <p className="quote-card-loading">Drawing the card…</p>
        )}
      </div>

      <div className="modal-actions">
        {canShareFile && (
          <button type="button" className="primary-button" onClick={share}>
            <Icon name="share" size={17} /> Share
          </button>
        )}
        <button type="button" className={canShareFile ? "secondary-button" : "primary-button"} disabled={!ready} onClick={download}>
          <Icon name="download" size={17} /> Download picture
        </button>
        <button type="button" className="ghost-button" onClick={copy}>
          Copy the quote
        </button>
      </div>
      <p className="form-success quote-card-status" role="status">
        {status}
      </p>
    </div>
  );
}
